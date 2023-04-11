/* FIREBASE初期化 */

//import firebase app
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.13.0/firebase-app.js';

//import firebase authentication
import { 
    getAuth, onAuthStateChanged, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, signOut, updateEmail,
    EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/9.13.0/firebase-auth.js';

//import firebase firestore
import { 
    getFirestore, doc, collection,
    getDocs, setDoc, addDoc,
    updateDoc, deleteDoc, arrayUnion,
    arrayRemove, deleteField
} from "https://www.gstatic.com/firebasejs/9.13.0/firebase-firestore.js";

//import firebase cloud storage
import { getStorage, ref, uploadString, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.13.0/firebase-storage.js';

//firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBfvEc3PMacUM8wi6YXk5-CVZEuONo2bg8",
    authDomain: "minkenapp-6103e.firebaseapp.com",
    projectId: "minkenapp-6103e",
    storageBucket: "minkenapp-6103e.appspot.com",
    messagingSenderId: "294465380826",
    appId: "1:294465380826:web:c859a9e1a1bad2ca2f20e3",
    measurementId: "G-ZR4RN01Z7Y"  
};

//initialize firebase app
const app = initializeApp(firebaseConfig);

//initialize firebase authentication
const auth = getAuth(app);

//initialize firebase firestore
const db = getFirestore(app);

//initialize firebase cloud storage
const storage = getStorage(app);

/* データベース関連 */

var docs = new Object();

async function getFirebaseDocs (docName) {
    let newCollection  = await getDocs(collection(db, docName));

    return docs[docName] = newCollection.docs;
}

function getDocByType (value, type, collection) {
    let doc = undefined;

    if ( type == 'id' ) { 
        doc = docs[collection].find(doc => doc.id == value);
    } else {
        doc = docs[collection].find(doc => doc.data()[type] == value);
    }

    return doc;
}

function getArrayFromCollection (collection) {
    const arrayFromCollection = new Array();

    collection.forEach( doc => {
        arrayFromCollection.push(doc.data()['name']);
    })

    return arrayFromCollection;
}

async function createUser (name, furigana, course, part, email, password) {
    await createUserWithEmailAndPassword(auth, email, password).then( async (userCredential) => {
        currentUser = userCredential.user;
        await setDoc(doc(db, 'users', currentUser.uid), {
            'bands': arrayUnion(),
            'course': course,
            'email': email,
            'furigana': furigana,
            'isAdmin': false, 
            'name': name,
            'part': part
        });
    }).catch( (error) => {
        
    });

    return await getFirebaseDocs('users');
}

async function updateUser (displayImage, name, furigana, course, part, email) {
    if ( currentUser['email'] !== email ) {
        await updateEmail(currentUser, email).then( () => {
        }).catch( async (error) => {
            await showReauthenticateModal();
            await updateUser (displayImage, name, furigana, course, part, email);
        });
    }

    if ( currentUserData['name'] !== name ) {
        currentUserData['bands'].forEach( async band => {
            const bandDoc = getDocByType(band, 'name', 'bands');
            const bandData = bandDoc.data();
            const membersSet = new Set(bandData['members']);
            membersSet.delete(currentUserData['name']);
            membersSet.add(name);
            const leader = (bandData['leader'] === currentUserData['name']) ? name : bandData['leader'];
            await updateBand(bandDoc.id, bandData['name'], membersSet, leader, bandData['displayImage']);
        })
    }

    let displayImageLink;
    if ( displayImage === './images/nodisplayimage.jpg' || displayImage === currentUserData['displayImage'] ) {
        displayImageLink = displayImage;
    } else {
        const displayImageRef = ref(storage, `displayImages/${name}`);
        const displayImageBase64 = displayImage.split(',')[1];

        await uploadString(displayImageRef, displayImageBase64, 'base64').then( async () => {
            await getDownloadURL(displayImageRef).then( (url) => {
                displayImageLink = url;        
            });
        }).catch( (error) => {
            alert(error.message);
            alert(error.code);
        });
    }

    await updateDoc(doc(db, "users", currentUser.uid), {
        'name': name,
        'furigana': furigana,
        'course': course,
        'part': part,
        'bands': currentUserData['bands'],
        'displayImage': displayImageLink
    }).catch( (error) => {
        alert(error.message);
        alert(error.code);
    });

    await getFirebaseDocs('bands');
    return await getFirebaseDocs('users');
}

async function createBand (name, members, leader, displayImage) {
    members.forEach( async (memberName) => {
        const memberId = getDocByType(memberName, 'name', 'users').id;
        await updateDoc(doc(db, 'users', memberId), {
            'bands': arrayUnion(name)
        });
    })

    let displayImageLink;
    if ( displayImage === './images/nodisplayimage.jpg' || displayImage === currentUserData['displayImage'] ) {
        displayImageLink = displayImage;
    } else {
        const displayImageRef = ref(storage, `displayImages/${name}`);
        const displayImageBase64 = displayImage.split(',')[1];

        await uploadString(displayImageRef, displayImageBase64, 'base64').then( async () => {
            await getDownloadURL(displayImageRef).then( (url) => {
                displayImageLink = url;        
            });
        }).catch( (error) => {
            alert(error.message);
            alert(error.code);
        });
    }

    await addDoc(collection(db, 'bands'), {
        'name': name,
        'members': Array.from(members),
        'leader': leader,
        'displayImage': displayImageLink
    });

    await getFirebaseDocs('users');
    currentUserData = await getDocByType(currentUser.uid, 'id', 'users').data();
    return await getFirebaseDocs('bands');
}

async function updateBand (id, newName, newMembers, leader, displayImage) {
    const bandDoc = getDocByType(id, 'id', 'bands');
    const bandData = bandDoc.data();
    const oldName = bandData['name'];

    newMembers.forEach( async (memberName) => {
        if ( getDocByType(memberName, 'name', 'users') === undefined ) { return; };
        const memberId = getDocByType(memberName, 'name', 'users').id;

        await updateDoc(doc(db, 'users', memberId), { 'bands': arrayRemove(oldName) });
        await updateDoc(doc(db, 'users', memberId), { 'bands': arrayUnion(newName) });
    })

    const removedMembers = new Set(bandData['members']);
    newMembers.forEach( newMember => {
        removedMembers.delete(newMember);
    })

    if ( removedMembers ) {
        removedMembers.forEach( async (memberName) => {
            const memberId = getDocByType(memberName, 'name', 'users').id;
    
            await updateDoc(doc(db, 'users', memberId), {
                'bands': arrayRemove(oldName)
            });
        })
    }

    let displayImageLink;
    if ( displayImage === './images/nodisplayimage.jpg' || displayImage === currentUserData['displayImage'] ) {
        displayImageLink = displayImage;
    } else {
        const displayImageRef = ref(storage, `displayImages/${name}`);
        const displayImageBase64 = displayImage.split(',')[1];

        await uploadString(displayImageRef, displayImageBase64, 'base64').then( async () => {
            await getDownloadURL(displayImageRef).then( (url) => {
                displayImageLink = url;        
            });
        }).catch( (error) => {
            alert(error.message);
            alert(error.code);
        });
    }

    await setDoc(doc(db, 'bands', id), {
        'name': newName,
        'members': Array.from(newMembers),
        'leader': leader,
        'displayImage': displayImageLink
    });

    await getFirebaseDocs('users');
    currentUserData = await getDocByType(currentUser.uid, 'id', 'users').data();
    return await getFirebaseDocs('bands');
}

async function deleteBand (id) {
    const bandDoc = getDocByType(id, 'id', 'bands');
    const bandName = bandDoc.data()['name'];
    const members = bandDoc.data()['members'];
    members.forEach( async (memberName) => {
        const memberId = getDocByType(memberName, 'name', 'users').id;

        await updateDoc(doc(db, 'users', memberId), {
            'bands': arrayRemove(bandName)
        });
    })

    await deleteDoc(doc(db, 'bands', id));

    await getFirebaseDocs('users');
    currentUserData = await getDocByType(currentUser.uid, 'id', 'users').data();
    return await getFirebaseDocs('bands');
}

async function createPost (type, username, date, details) {
    await addDoc(collection(db, 'posts'), {
        'type': type,
        'username': username,
        'date': date,
        'details': details
    });

    return await getFirebaseDocs('posts');
}

async function updatePost (id, details) {
    await updateDoc(doc(db, 'posts', id), {
        'details': details
    });

    console.log('updated doc')

    return await getFirebaseDocs('posts');
}

async function deletePost (id) {
    await deleteDoc(doc(db, 'posts', id));

    return await getFirebaseDocs('posts');
}

async function makeReservation (year, month, day, time, id, solo) {
    await setDoc(doc(db, 'reservations', `${year}-${month}`), {
        [day]: {
            [time]: {
                'reserved': true,
                'id': id,
                'isSolo': solo
            }
        }
    }, {merge: true});

    await getFirebaseDocs('reservations');
}

async function cancelReservation (year, month, day, time) {
    await setDoc(doc(db, 'reservations', `${year}-${month}`), {
        [day]: {
            [time]: {
                'reserved': false
            }
        }
    }, {merge: true});

    await getFirebaseDocs('reservations');
}

async function createReservationSlot (startDateString, endDateString, timeslots) {
    const startDate = new Date(startDateString);
    const endDate = new Date(endDateString);

    const differenceInTime = endDate.getTime() - startDate.getTime();
    const differenceInDays = differenceInTime / (1000 * 3600 * 24);

    for ( let i = 0; i < differenceInDays + 1; i++) {
        const date = new Date(startDate);
        date.setDate( startDate.getDate() + i );
        const yearMonth = `${date.getFullYear()}-${date.getMonth() + 1}`;
        const day = `${date.getDate()}`;

        for (let j = 0; j < timeslots.length; j++) {
            const time = timeslots[j];
            await setDoc(doc(db, "reservations", yearMonth), {
                [day]: {
                    [time]: {
                        'reserved': false
                    }
                }
            }, {merge:true});
        }
    }

    window.location.reload();
}

async function deleteReservationSlot (year, month, day, time) {
    await setDoc(doc(db, 'reservations', `${year}-${month}`), {
        [day]: {
            [time]: deleteField()
        }
    }, {merge: true});

    return await getFirebaseDocs('reservations');
}

/* 関数 */

function usernameExists (name) {
    return docs['users'].find(user => (user.data().name).replace(/\s+/g, '') == name.replace(/\s+/g, '') ) !== undefined;
}

function emailExists (email) {
    return docs['users'].find(user => user.data().email == email) !== undefined;
}

function bandnameExists (name) {
    return docs['bands'].find(band => band.data().name == name ) !== undefined;
}

function getDisplayImage (name, type) {
    const data = getDocByType(name, 'name', type).data();
    const displayImage = (data['displayImage'] !== undefined) ? data['displayImage'] : './images/nodisplayimage.jpg';

    return displayImage;
}

function changeDisplayImage (chosenFiles, container) {
    
    return new Promise (resolve => {
        let image = chosenFiles.files[0];

        if ( image !== undefined ) {
            const reader = new FileReader();

            reader.addEventListener('load', e => {
                const blob = new Blob([e.target.result]); // create blob...
                window.URL = window.URL || window.webkitURL;
                const blobURL = window.URL.createObjectURL(blob); // and get it's URL

                const image = new Image();
                image.src = blobURL;
                image.onload = () => {
                    // have to wait till it's loaded
                    const canvas = document.createElement('canvas');
  
                    const max_width = 500;
                    const max_height = 500;

                    let width = image.width;
                    let height = image.height;
                
                    // calculate the width and height, constraining the proportions
                    if (width > height) {
                        if (width > max_width) {
                            height = Math.round(height *= max_width / width);
                            width = max_width;
                        }
                    } else {
                        if (height > max_height) {
                            width = Math.round(width *= max_height / height);
                            height = max_height;
                        }
                    }
                    
                    // resize the canvas and draw the image data into it
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(image, 0, 0, width, height);
                    
                    container.appendChild(canvas); // do the actual resized preview
                    
                    const resizedImage = canvas.toDataURL("image/jpeg", 0.7); // send it to canvas
                    container.setAttribute('src', resizedImage);
                    resolve(resizedImage);
                }
            });
            
            reader.readAsArrayBuffer(image);
        }
    });
}

function getCoordinates (element) {
    const rect = element.getBoundingClientRect();
    return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom
    };
}

function getSize (element) {
    const rect = element.getBoundingClientRect();
    print
    return {
        width: rect.width,
        height: rect.height
    };
}

function showErrorDiv ({text, element}) {
    const errorDiv = document.createElement('div');
    errorDiv.setAttribute('id', 'error-message');
    errorDiv.setAttribute('tabindex', '-1');
    errorDiv.innerHTML = text;

    errorDiv.addEventListener('focusout', (e) => {
        if (!errorDiv.contains(e.relatedTarget)) { errorDiv.remove(); };
    });

    const elementXCoord = getCoordinates(element).left;
    const elementYCoord = getCoordinates(element).bottom;

    errorDiv.setAttribute('style', `top: ${elementYCoord + 12}px; left: ${elementXCoord}px;`)

    document.body.appendChild(errorDiv);

    errorDiv.focus();
}

async function showContextMenu ({button, type, doc} = {}) {
    const contextMenu = document.createElement('div');
    contextMenu.setAttribute('id', 'context-menu');
    contextMenu.setAttribute('tabindex', '-1');

    switch (type) {
        case 'main':
            contextMenu.innerHTML = `
                <button id="refresh-button" class="context-menu-button">更新</button>
                <button id="feedback-button" class="context-menu-button">フィードバックを送信</button>
                <button id="logout-button" class="context-menu-button">ログアウト</button>
            `;

            const refreshButton = contextMenu.querySelector('#refresh-button');
            refreshButton.addEventListener('click', () => { window.location.reload() });

            const feedbackButton = contextMenu.querySelector('#feedback-button');
            feedbackButton.addEventListener('click', () => { window.location.href = "mailto:systemminken@gmail.com?subject=民研アプリフィードバック"; });

            const logoutButton = contextMenu.querySelector('#logout-button');
            logoutButton.addEventListener('click', async function logoutUser () {
                const confirmationMessage = 'ログアウトしますか？';
                const confirmationAction = 'ログアウト';
                await showConfirmationModal({message: confirmationMessage, action: confirmationAction}).then( response => {
                    if ( response == 'confirmed' ) {
                        signOut(auth).then( () => { document.location.reload(); })
                    }
                });
            });

            break;

        case 'post':
            contextMenu.innerHTML = `
                <button id="edit-post" class="context-menu-button">編集</button>
                <button id="delete-post" class="context-menu-button">削除</button>
            `;

            const editPostButton = contextMenu.querySelector('#edit-post');
            editPostButton.addEventListener('click', () => { document.activeElement.blur(); showAccordion({type: 'editPost', data: doc}); })

            const deltePostButton = contextMenu.querySelector('#delete-post');
            deltePostButton.addEventListener('click', async () => {
                const confirmationMessage = '投稿を削除しますか？';
                const confirmationAction = '削除';
                await showConfirmationModal({message: confirmationMessage, action: confirmationAction}).then( async (response) => {
                    if ( response == 'confirmed' ) {
                        await deletePost(doc.id);
                        loadHomePageData();
                    } else {
                        closeModal();
                    }
                });
            })

            break;

        case 'band':
            contextMenu.innerHTML = `
                <button id="edit-band" class="context-menu-button">編集</button>
                <button id="delete-band" class="context-menu-button">削除</button>
                <button id="leave-band" class="context-menu-button">退会</button>
            `;

            const editBandButton = contextMenu.querySelector('#edit-band');
            editBandButton.addEventListener('click', () => { document.activeElement.blur(); showAccordion({type: 'editBand', data: doc}); })

            const deleteBandButton = contextMenu.querySelector('#delete-band');
            deleteBandButton.addEventListener('click', async () => {
                const confirmationMessage = `${doc.data()['name']}を削除しますか？`;
                const confirmationAction = '削除';
                await showConfirmationModal({message: confirmationMessage, action: confirmationAction}).then( async (response) => {
                    if ( response == 'confirmed' ) {
                        await deleteBand(doc.id);
                        loadMemberPageData();
                    } else {
                        closeModal();
                    }
                });
            })

            const leaveBandButton = contextMenu.querySelector('#leave-band');
            leaveBandButton.addEventListener('click', async () => {
                const confirmationMessage = `${doc.data()['name']}を退会しますか？`;
                const confirmationAction = '退会';
                await showConfirmationModal({message: confirmationMessage, action: confirmationAction}).then( async (response) => {
                    if ( response == 'confirmed' ) {
                        const bandData = doc.data();
                        const newMembers = new Set(bandData['members']);
                        newMembers.delete(currentUserData['name']);
                        await updateBand(doc.id, bandData['name'], newMembers, bandData['leader'], bandData['displayImage']);
                        loadMemberPageData();
                    } else {
                        closeModal();
                    }
                });
            });

            break;
    }

    contextMenu.addEventListener('focusout', (e) => {
        if (!contextMenu.contains(e.relatedTarget)) {
            contextMenu.remove();
        }
    });
    
    const buttonXCoord = getCoordinates(button).left;
    const buttonYCoord = getCoordinates(button).top;

    const contextMenuXCoord = Math.max(buttonXCoord - 10, 240);
    const contextMenuYCoord = buttonYCoord + 30;

    contextMenu.setAttribute('style', `top: ${contextMenuYCoord}px; left: ${contextMenuXCoord}px;`)

    contextMenu.classList.add('fadeIn');
    document.body.appendChild(contextMenu);
    window.setInterval( () => { contextMenu.classList.remove('fadeIn'); }, 210);

    contextMenu.focus();
}

function loadBandItems ({container, bands, buttonImg} = {}) {
    const oldItems = container.querySelectorAll('.item');
    oldItems.forEach( item => {
        item.remove();
    })

    const containerFragement = new DocumentFragment();
    bands.forEach( band => {
        const bandDoc = getDocByType(band, 'name', 'bands');

        const item = document.createElement('div');
        item.classList.add('item');
        item.classList.add('showMore');
        window.setInterval( () => { item.classList.remove('showMore'); }, 120);

        const displayImage = getDisplayImage(band, 'bands');

        item.innerHTML = `
            <img class="display-image" src="${displayImage}"></img>
            <div class="item-name">${band}</div>
        `;

        if ( container.getAttribute('id') == 'my-bands-container' ) {
            const itemKebabMenu = document.createElement('button');
            itemKebabMenu.classList.add('icon-button', 'item-kebab-menu');
            itemKebabMenu.setAttribute('type', 'button');
            itemKebabMenu.setAttribute('style', 'z-index: 1');
            const itemKebabMenuImg =  document.createElement('img');
            itemKebabMenuImg.setAttribute('src', './images/kebab.svg');

            itemKebabMenu.addEventListener('click', (event) => {
                event.stopPropagation();
                showContextMenu({button: itemKebabMenu, type: 'band', doc: bandDoc})
            })

            itemKebabMenu.appendChild(itemKebabMenuImg);
            item.appendChild(itemKebabMenu);
        };

        item.addEventListener('click', () => { showModal({type:'band', data:band}) });

        containerFragement.appendChild(item);
    });

    if ( buttonImg != undefined ) {
        buttonImg.setAttribute('style', `
            -moz-transform: scale(-1, -1); 
            -o-transform: scale(-1, -1);
            -webkit-transform: scale(-1, -1);
            transform: scale(-1, -1);
        `);
    }

    container.classList.add('hidden');
    container.classList.add('showMore')
    container.appendChild(containerFragement);
    container.classList.remove('hidden');

    window.setInterval( () => { container.classList.remove('showMore'); }, 120);
}

function loadUserItems ({container, users, buttonImg} = {}) {
    const oldItems = container.querySelectorAll('.item');
    oldItems.forEach( item => {
        item.remove();
    })

    const containerFragement = new DocumentFragment();
    users.forEach( user => {
        const userData = getDocByType(user, 'name', 'users').data();

        const item = document.createElement('div');
        item.classList.add('item');
        item.classList.add('showMore');
        window.setInterval( () => { item.classList.remove('showMore'); }, 120);

        const displayImage = getDisplayImage(user, 'users');

        item.innerHTML = `
            <img class="display-image" src="${displayImage}"></img>
            <div class="item-name">${user}</div>
        `;

        if ( accordionBody.contains(container) ) {
            if ( userData['name'] != currentUserData['name'] ) {
                const removeMemberButton = document.createElement('button');
                removeMemberButton.classList.add('icon-button', 'remove-member-button');
                removeMemberButton.setAttribute('type', 'button');
                const removeMemberButtonImg =  document.createElement('img');
                removeMemberButtonImg.setAttribute('src', './images/exit.svg');

                removeMemberButton.appendChild(removeMemberButtonImg);
                item.appendChild(removeMemberButton);
            }
        }

        item.addEventListener('click', () => { showModal({type:'user', data: user}); });

        containerFragement.appendChild(item);
    });

    if ( buttonImg != undefined ) {
        buttonImg.setAttribute('style', `
            -moz-transform: scale(-1, -1); 
            -o-transform: scale(-1, -1);
            -webkit-transform: scale(-1, -1);
            transform: scale(-1, -1);
        `);
    }

    container.classList.add('hidden');
    container.classList.add('showMore')
    container.appendChild(containerFragement);
    container.classList.remove('hidden');

    window.setInterval( () => { container.classList.remove('showMore'); }, 120);
}

function clearItems (container) {
    const oldItems = container.querySelectorAll('.item');
    container.classList.add('showLess');
    oldItems.forEach( oldItem => { 
        oldItem.classList.add('showLess');
        window.setInterval( () => { oldItem.remove(); }, 120);
    });
    window.setInterval( () => { 
        container.classList.remove('showLess');
    }, 120);
}

/* ページ関連 */

const pagesContainer = document.querySelector('#pages-container');
const page = new Array();
const navButton = new Object();
const accordionButton = new Object();
var lastPage = 'home';

page['home'] = pagesContainer.querySelector('#home-page');
page['member'] = pagesContainer.querySelector('#member-page');
page['reservation'] = pagesContainer.querySelector('#reservation-page');

navButton['home'] = document.querySelector('#home-button');
navButton['reservation'] = document.querySelector('#reservation-button');
navButton['member'] = document.querySelector('#member-button');

navButton['home'].addEventListener('click', () => { showPage('home'); });
navButton['reservation'].addEventListener('click', () => { showPage('reservation'); });
navButton['member'].addEventListener('click', () => { showPage('member'); });

accordionButton['home'] = document.querySelector('#home-accordion-button');
accordionButton['member'] = document.querySelector('#member-accordion-button');

accordionButton['home'].addEventListener('click', () => { showAccordion({type: 'createPost'}); });
accordionButton['member'].addEventListener('click', () => { showAccordion({type: 'createBand'}) });


const pageNumber = {'reservation': 0, 'home': 1, 'member': 2};

function showPage (name) {
    if ( name == lastPage ) { return 0; }

    switch (name) {
        case 'home': loadHomePageData(); break;
        case 'member': loadMemberPageData(); break;
        case 'reservation': loadReservationPageData(); break;
    }

    page[name].classList.remove('hidden');
    if ( accordionButton[lastPage] !== undefined ) { accordionButton[lastPage].classList.add('hidden'); };
    if ( accordionButton[name] !== undefined ) { accordionButton[name].classList.remove('hidden'); };
    navButton[name].classList.add('selected');
    navButton[lastPage].classList.remove('selected');
    if ( pageNumber[name] > pageNumber[lastPage] ) {
        page[lastPage].classList.add('squeeze');
        page[name].classList.add('inFromRight');
        window.setTimeout( function pageAnimation () {
            navButton[lastPage].classList.remove('selected');
            page[lastPage].classList.remove('squeeze');
            page[name].classList.remove('inFromRight'); 
            page[lastPage].classList.add('hidden');
            lastPage = name;
        }, 160);
    } else {
        page[lastPage].classList.add('squeeze');
        page[name].classList.add('inFromLeft');
        window.setTimeout( function pageAnimation () { 
            navButton[lastPage].classList.remove('selected');
            page[lastPage].classList.remove('squeeze'); 
            page[name].classList.remove('inFromLeft');
            page[lastPage].classList.add('hidden');
            lastPage = name;
        }, 160);
    }
}

function loadHomePageData () {
    const oldPosts = page['home'].querySelectorAll('.post');
    oldPosts.forEach( oldPost => {
        oldPost.remove();
    });

    const postDocs = docs['posts'].sort((a,b) => (a.data()['date'] > b.data()['date']) ? -1 : ((b.data()['date'] > a.data()['date']) ? 1 : 0));

    const noticesFragement = new DocumentFragment();
    const recruitmentsFragement = new DocumentFragment();
    postDocs.forEach( postDoc => {
        const post = document.createElement('div');
        post.classList.add('post');

        const postData = postDoc.data();
        const userData = getDocByType(postData['username'], 'name', 'users').data();
        const displayImage = getDisplayImage(userData['name'], 'users');

        post.innerHTML = `
            <div class="post-header">
                <div class="post-user">
                    <img class="display-image" src="${displayImage}">
                    <div class="post-header-text">
                        <div class="post-username">${postData['username']}</div>
                        <div class="post-date">${postData['date']}</div>
                    </div>
                </div>
            </div>
            <div class="post-body">${postData['details']}</div>
        `;

        post.querySelector('.post-body').addEventListener('click', () => { showAccordion({type: 'post', data: {postData, displayImage}}); });

        post.querySelector('.post-user').addEventListener('click', () => { showModal({type:'user', data:postData['username']}); });

        if ( postData['username'] == currentUserData['name'] ) {
            const postKebabMenu = document.createElement('button');
            postKebabMenu.classList.add('post-kebab-menu', 'icon-button');
            postKebabMenu.setAttribute('type', 'button');
            const postKebabMenuImage = document.createElement('img');
            postKebabMenuImage.setAttribute('src', './images/kebab.svg')
            postKebabMenu.appendChild(postKebabMenuImage);

            postKebabMenu.addEventListener('click', () => {
                showContextMenu({button: postKebabMenu, type: 'post', doc: postDoc});
            });

            post.querySelector('.post-header').appendChild(postKebabMenu);
        }

        if ( postData['type'] == 'notice' ) { noticesFragement.appendChild(post) };
        if ( postData['type'] == 'recruitment' ) { recruitmentsFragement.appendChild(post) };
    });

    const noticesContainer = page['home'].querySelector('#notices-container');
    noticesContainer.appendChild(noticesFragement);

    const recruitmentsContainer = page['home'].querySelector('#recruitments-container');
    recruitmentsContainer.appendChild(recruitmentsFragement);
}

const myBandsButton = page['member'].querySelector('#my-bands-button');
const myBandsButtonImg = myBandsButton.querySelector('img');
const myBandsContainer = page['member'].querySelector('#my-bands-container')
myBandsButton.addEventListener('click', () => {
    const toggleState = myBandsButton.getAttribute('toggled');
    if (toggleState == 'off') {
        loadBandItems({container: myBandsContainer, bands: currentUserData['bands'], buttonImg: myBandsButtonImg})
        myBandsButton.setAttribute('toggled', 'on');
    } else {
        clearItems(myBandsContainer);
        myBandsButtonImg.setAttribute('style', '');
        myBandsButton.setAttribute('toggled', 'off');
    }
});

const allBandsButton = page['member'].querySelector('#all-bands-button');
const allBandsButtonImg = allBandsButton.querySelector('img');
const allBandsContainer = page['member'].querySelector('#all-bands-container')
allBandsButton.addEventListener('click', () => {
    const toggleState = allBandsButton.getAttribute('toggled');
    if (toggleState == 'off') {
        const bandsArray = getArrayFromCollection(docs['bands']);
        loadBandItems({container: allBandsContainer, bands: bandsArray, buttonImg: allBandsButtonImg})
        allBandsButton.setAttribute('toggled', 'on');
    } else {
        clearItems(allBandsContainer);
        allBandsButtonImg.setAttribute('style', '');
        allBandsButton.setAttribute('toggled', 'off');
    }
});

const allUsersButton = page['member'].querySelector('#all-users-button');
const allUsersButtonImg = allUsersButton.querySelector('img');
const allUsersContainer = page['member'].querySelector('#all-users-container')
allUsersButton.addEventListener('click', () => {
    const toggleState = allUsersButton.getAttribute('toggled');
    if (toggleState == 'off') {
        const usersArray = getArrayFromCollection(docs['users']);
        loadUserItems({container: allUsersContainer, users: usersArray, buttonImg: allUsersButtonImg})
        allUsersButton.setAttribute('toggled', 'on');
    } else {
        clearItems(allUsersContainer);
        allUsersButtonImg.setAttribute('style', '');
        allUsersButton.setAttribute('toggled', 'off');
    }
});

function loadMemberPageData () {
    const oldItems = page['member'].querySelectorAll('.item');
    oldItems.forEach( oldItem => oldItem.remove() );

    loadBandItems({container: myBandsContainer, bands: currentUserData['bands'], buttonImg: myBandsButtonImg})
    myBandsButton.setAttribute('toggled', 'on');
    allBandsButtonImg.setAttribute('style', '');
    allBandsButton.setAttribute('toggled', 'off');
    allUsersButtonImg.setAttribute('style', '');
    allUsersButton.setAttribute('toggled', 'off');
}

/* 予約カレンダー関連 */

let nav;

const calendarContainer = page['reservation'].querySelector('#calendar-container');
const calendarYearMonthDislpay = calendarContainer.querySelector('#calendar-year-month-display');
const calendarBody = calendarContainer.querySelector('#calendar-body');
const reservationsContainer = page['reservation'].querySelector('#reservations-container');
const reservationsTitle = reservationsContainer.querySelector('.content-header');
const calendarNextButton = calendarContainer.querySelector('#calendar-next');
const calendarBackButton = calendarContainer.querySelector('#calendar-back');
calendarNextButton.addEventListener('click', () => { nav++; loadCalendar(); });
calendarBackButton.addEventListener('click', ()=> { nav--; loadCalendar(); });

function loadCalendar () {
    reservationsContainer.classList.add('hidden');
    const oldDays = calendarBody.querySelectorAll('.day');
    oldDays.forEach( (oldDay) => {
        oldDay.remove();
    });

    const displayedDateObject = new Date();
    displayedDateObject.setDate(1);
    displayedDateObject.setMonth( (displayedDateObject.getMonth()) + nav);

    const displayedMonth = displayedDateObject.getMonth();
    const displayedYear = displayedDateObject.getFullYear();

    const yearMonth = `${displayedYear}-${displayedMonth + 1}`;

    const displayedReservationDoc = getDocByType(yearMonth, 'id', 'reservations');
    const displayedReservationData = ( displayedReservationDoc !== undefined )  ? displayedReservationDoc.data() : undefined;

    calendarYearMonthDislpay.innerHTML = `${displayedYear}年 ${displayedMonth +1 }月`

    const firstDayOfMonth = new Date(displayedYear, displayedMonth, 1);
    const daysInMonth = new Date(displayedYear, displayedMonth + 1, 0).getDate();

    const paddingDays = firstDayOfMonth.getDay();

    const totalDayDivs = ( ((paddingDays + daysInMonth) % 7) == 0 ) ? (paddingDays + daysInMonth) : (paddingDays + daysInMonth) + (7 - ( (paddingDays + daysInMonth) % 7));

    for (let i = 1; i <= totalDayDivs; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('day');

        if ( !((i <= paddingDays) || (i > daysInMonth + paddingDays)) ) {
            const displayedDay = `${i - paddingDays}`;
            dayDiv.innerHTML = displayedDay;

            if( displayedReservationData !== undefined ) {
                if ( displayedDay in displayedReservationData ) {
                    const reservationTimeDatas = displayedReservationData[displayedDay];
                    dayDiv.addEventListener('click', () => {
                        showReservationsData(displayedYear, displayedMonth + 1, displayedDay, reservationTimeDatas);
                    })
                    for(const timeData of Object.values(reservationTimeDatas)) {
                        if( timeData['reserved'] == false ) {
                            dayDiv.classList.add('not-reserved');
                        } else {
                            dayDiv.classList.add('reserved');
                        }
                    }
                }
            }
        }

        calendarBody.appendChild(dayDiv);
    }
}

function showReservationsData (year, month, day, timeDatas) {

    const oldTimeDatas = reservationsContainer.querySelectorAll('.reservation');
    oldTimeDatas.forEach( oldTimeData => { oldTimeData.remove(); });

    reservationsContainer.classList.remove('hidden');
    reservationsTitle.innerHTML = `${month}月 ${day}日`;

    const reservationsFragement = new DocumentFragment();
    Object.keys(timeDatas).sort().forEach( time => {
        const reservationData = timeDatas[time];
        const reservationDiv = document.createElement('div');
        reservationDiv.classList.add('reservation');

        let [startTime, endTime] = time.split('-');
        startTime = ( startTime.charAt(0) == '0' ) ? (startTime.substring(0, 2) + ':' + startTime.substring(2)).slice(1) : startTime.substring(0, 2) + ':' + startTime.substring(2);
        endTime = ( endTime.charAt(0) == '0' ) ? (endTime.substring(0, 2) + ':' + endTime.substring(2)).slice(1) : endTime.substring(0, 2) + ':' + endTime.substring(2);

        reservationDiv.innerHTML = `
            <div class="reservation-header">${startTime} ~ ${endTime}</div>
            <div class="reservation-content"></div>
        `;

        const reservationContent = reservationDiv.querySelector('.reservation-content');
        if ( reservationData['reserved'] == true ) {
            reservationContent.innerHTML = `
                <div class="item-container"></div>
            `;

            const reserver = reservationData['isSolo'] == true ? getDocByType(reservationData['id'], 'id', 'users').data()['name'] : getDocByType(reservationData['id'], 'id', 'bands').data()['name'];
            if ( reservationData['isSolo'] == true ) { 
                loadUserItems({container: reservationContent.querySelector('.item-container'), users: [reserver]}) 
            } else { 
                loadBandItems({container: reservationContent.querySelector('.item-container'), bands: [reserver]}) 
            };

            if ( (reserver == currentUserData['name']) || currentUserData['bands'].includes(reserver) ) {
                const cancelReservationButton = document.createElement('button');
                cancelReservationButton.innerHTML = '取り消す';
                cancelReservationButton.classList.add('submit-button');

                cancelReservationButton.addEventListener('click', async () => {
                    const confirmationMessage = `${year}-${month}-${day} ${startTime} ~ ${endTime}の予約を取り消しますか？`;
                    const confirmationAction = '取り消す';
                    await showConfirmationModal({message: confirmationMessage, action: confirmationAction}).then( async (response) => {
                        if ( response == 'confirmed' ) {
                            
                            await cancelReservation(year, month, day, time);

                            const reservationDoc = getDocByType(`${year}-${month}`, 'id', 'reservations');
                            const reservationData = ( reservationDoc !== undefined )  ? reservationDoc.data() : undefined;
                            const reservationTimeDatas = reservationData[day];

                            showReservationsData(year, month, day, reservationTimeDatas);
                            closeModal();
                        } else {
                            closeModal();
                        }
                    });
                });

                reservationContent.appendChild(cancelReservationButton);
            }
        } else {
            reservationContent.innerHTML = `
                <select class="band-select">
                    <option value="solo">個人練習</option>
                </select>
                <button class="submit-button">予約</button>
            `;
            const bandSelect = reservationContent.querySelector('.band-select');
            currentUserData['bands'].forEach( band => {
                const bandOption = document.createElement('option');
                bandOption.setAttribute('value', band);
                bandOption.innerHTML = band;

                bandSelect.appendChild(bandOption);
            })

            const makeReservationButton = reservationContent.querySelector('.submit-button');
            makeReservationButton.addEventListener('click', async () => {
                let reserverId, isSolo;
                if ( bandSelect.value == 'solo' ) {
                    reserverId = currentUser.uid;
                    isSolo = true;
                } else {
                    reserverId = getDocByType(bandSelect.value, 'name', 'bands').id;
                    isSolo = false;
                }

                await makeReservation(year, month, day, time, reserverId, isSolo);

                const reservationDoc = getDocByType(`${year}-${month}`, 'id', 'reservations');
                const reservationData = ( reservationDoc !== undefined )  ? reservationDoc.data() : undefined;
                const reservationTimeDatas = reservationData[day];

                showReservationsData(year, month, day, reservationTimeDatas);
            })
        }
    
        if ( currentUserData['isAdmin'] === true ) {
            const deleteSlotButton = document.createElement('button');
            deleteSlotButton.innerHTML = '予約枠削除'
            deleteSlotButton.setAttribute('style', 'margin-top: 10px;')
            deleteSlotButton.classList.add('submit-button');
            
            deleteSlotButton.addEventListener('click', async () => {
                const confirmationMessage = '予約枠を削除しますか？';
                const confirmationAction = '削除';
                await showConfirmationModal({message: confirmationMessage, action: confirmationAction}).then( async (response) => {
                    if ( response === 'confirmed' ) {
                        await deleteReservationSlot(year, month, day, time);
                        
                        const reservationDoc = getDocByType(`${year}-${month}`, 'id', 'reservations');
                        const reservationData = ( reservationDoc !== undefined )  ? reservationDoc.data() : undefined;
                        const reservationTimeDatas = reservationData[day];

                        showReservationsData(year, month, day, reservationTimeDatas);
                        closeModal();
                    } else {
                        closeModal();
                    }
                });
            });

            reservationDiv.appendChild(deleteSlotButton);
        }

        reservationsFragement.appendChild(reservationDiv);
    })

    reservationsContainer.appendChild(reservationsFragement);
    page['reservation'].scrollBy({left: 0, top: getCoordinates(reservationsTitle).top - 80, behavior: 'smooth'})
}

function loadReservationPageData () {
    nav = 0;
    loadCalendar();
}

/* モーダル関連 */

const modal = document.querySelector('#modal');
const modalHeader = modal.querySelector('#modal-header')
const modalBody = modal.querySelector('#modal-body');

function closeModal () {
    modal.classList.add('hidden');
    modalHeader.innerHTML = '';
    modalBody.innerHTML = '';

    const modalBackdrop = document.querySelector('#modal-backdrop');
    if ( modalBackdrop != undefined ) { modalBackdrop.remove(); };
}

function showModal ({type, data} = {}) {
    closeModal();

    switch (type) {
        case 'login': showLoginModal(); break;
        case 'resetPassword': showResetPasswordModal(); break;
        case 'signup': showSignupModal(); break;
        case 'myAccount': showMyAccountModal(); break;
        case 'user': showUserModal(data); break;
        case 'band': showBandModal(data); break;
        case 'confirmation': showConfirmationModal(data); break;
    }

    const modalBackdrop = document.createElement('div');
    modalBackdrop.setAttribute( 'id', 'modal-backdrop' );
    document.body.appendChild(modalBackdrop);

    modal.classList.remove('hidden');
    modal.classList.add('fadeIn');
    window.setInterval( () => { modal.classList.remove('fadeIn') }, 210 );
}

function showLoginModal () {
    modalHeader.innerHTML = '<div id="modal-title">ログイン</div>';
    modalBody.innerHTML = `
        <div class="field">
            <label for="email">メールアドレス</label>
            <input id="email" class="input" type="email" required>
        </div>
        <div class="field">
            <label for="password">パスワード</label>
            <input id="password" class="input" type="password" required>
            <button id="forgot-password-button" class="link-button" type="button">パスワードを忘れた</button>
        </div>
        <div class="buttons-group">
            <button id="login-button" class="submit-button" type="button">ログイン</button>
        </div>
        <button id="signup-button" class="link-button" type="button">アカウント作成</button>
    `;
    modalBody.querySelector('#forgot-password-button').addEventListener('click', () => { showModal({type:'resetPassword'}); });
    modalBody.querySelector('#signup-button').addEventListener('click', () => { showModal({type:'signup'}); });
    modalBody.querySelector('#login-button').addEventListener('click', async function loginUser () {
        const email = modalBody.querySelector('#email').value;
        const password = modalBody.querySelector('#password').value;

        await signInWithEmailAndPassword(auth, email, password).then( (userCredential) => {
            currentUser = userCredential.user;
            closeModal();
        }).catch( (error) => {
            return showErrorDiv({text: 'パスワードが間違っています', element: modalBody.querySelector('#password')});
        });
    })
}

function showResetPasswordModal () {
    closeModal();
    modal.classList.remove('hidden');
    modalHeader.innerHTML = `
        <button id="back-button" class="icon-button" type="button""><img src="./images/leftArrow.svg"></button>
        <div id="modal-title">パスワード再設定</div>
    `;
    modalBody.innerHTML = `
        <div id="modal-page-0" class="modal-page">
            <div class="field">
                <label for="email">メールアドレス</label>
                <input id="email" class="input" type="email" required>
            </div>
            <div class="buttons-group">
                <button class="submit-button" type="button">送信</button>
            </div>
        </div>
        <div id="modal-page-1" class="hidden modal-page">
            <div>メールアドレスに送信しました。</div>
        </div>
    `;

    modalHeader.querySelector('#back-button').addEventListener('click', () => { showModal({type:'login'}) });
    
    modalBody.querySelector('.submit-button').addEventListener('click', async function sendPasswordReset () {
        const email = modalBody.querySelector('#email').value;

        if ( !(emailExists(email)) ) { return showErrorDiv({text:'メールアドレスは存在しません', element: modalBody.querySelector('#email')}) };

        await sendPasswordResetEmail(auth, email).then( () => {
            modalBody.querySelector('#modal-page-0').classList.add('hidden');
            modalBody.querySelector('#modal-page-1').classList.remove('hidden');
        }).catch( (error) => {
        });
    });
}

function showSignupModal () {
    closeModal();
    modal.classList.remove('hidden');
    modalBody.classList.add('has-pages');
    modalHeader.innerHTML = `
        <button id="back-button" class="icon-button" type="button""><img src="./images/arrowleft.svg"></button>
        <div id="modal-title">アカウント作成</div>
    `;
    modalBody.innerHTML = `
        <div id="modal-page-0" class="modal-page">
            <div class="field">
                <label for="name">氏名</label>
                <input class="input" type="text" id="name" required>
            </div>
            <div class="field">
                <label for="furigana">フリガナ</label>
                <input class="input" type="text" id="furigana" required>
            </div>
            <div class="select-field-group">
                <div class="field">
                    <label for="course">クラス</label>
                    <select id="course" class="input">
                        <option value="1-5">1-5</option>
                        <option value="1-6">1-6</option>
                        <option value="1-7">1-7</option>
                        <option value="1-8">1-8</option>
                        <option value="T2">T2</option>
                        <option value="R2">R2</option>
                        <option value="A2">A2</option>
                        <option value="W2">W2</option>
                        <option value="T3">T3</option>
                        <option value="R3">R3</option>
                        <option value="A3">A3</option>
                        <option value="W3">W3</option>
                        <option value="T4">T4</option>
                        <option value="R4">R4</option>
                        <option value="A4">A4</option>
                        <option value="W4">W4</option>
                        <option value="T5">T5</option>
                        <option value="R5">R5</option>
                        <option value="A5">A5</option>
                        <option value="W5">W5</option>
                    </select>
                </div>
                <div class="field">
                    <label for="part">パート</label>
                    <select id="part" class="input">
                        <option value="未決定">未決定</option>
                        <option value="guitar">guitar</option>
                        <option value="bass">bass</option>
                        <option value="drums">drums</option>
                        <option value="keyboard">keyboard</option>
                        <option value="vocal">vocal</option>
                        <option value="PA">PA</option>
                    </select>
                </div>
            </div>
            <div class="buttons-group">
                <button id="next-button" class="submit-button" type="button">次へ</button>
            </div>
        </div>
        <div id="modal-page-1" class="hidden modal-page">
            <div class="field">
                <label for="email">メールアドレス</label>
                <input class="input" type="email" id="email" required>
            </div>
            <div class="field">
                <label for="password">パスワード</label>
                <input class="input" type="password" id="password" required>
            </div>
            <div class="field">
                <label for="re-password">パスワード再入力</label>
                <input class="input" type="password" id="re-password" required>
            </div>
            <div class="buttons-group">
                <button id="create-user-button" class="submit-button" type="button">作成</button>
            </div>
        </div>
    `;

    let name, furigana, course, part, email, password, repassword;

    const backButton = modalHeader.querySelector('#back-button');
    const signupBackButtonPressed = () => { showModal({type:'login'}); };
    backButton.addEventListener('click', signupBackButtonPressed );

    const createUserButton = modalBody.querySelector('#create-user-button');
    createUserButton.addEventListener('click', async () => {
        email = modalBody.querySelector('#email').value;
        password = modalBody.querySelector('#password').value;
        repassword = modalBody.querySelector('#re-password').value;

        if ( emailExists(email) ) { return showErrorDiv({text: 'メールアドレスは既に使われています', element: modalBody.querySelector('#email')})};
        if ( password !== repassword ) { return showErrorDiv({text: 'パスワードが一致していません', element: modalBody.querySelector('#re-password')})};

        await createUser(name, furigana, course, part, email, password);
        closeModal();
    });

    const nextButton = modalBody.querySelector('#next-button');
    nextButton.addEventListener('click', function modalNextPage () {

        name = modalBody.querySelector('#name').value;
        furigana = modalBody.querySelector('#furigana').value;
        course = modalBody.querySelector('#course').value;
        part = modalBody.querySelector('#part').value;

        if ( usernameExists(name) ) { return showErrorDiv({text: '氏名は既に使われています', element: modalBody.querySelector('#name')})};

        backButton.removeEventListener('click', signupBackButtonPressed);
        
        const modalPage0 = modalBody.querySelector('#modal-page-0');
        const modalPage1 = modalBody.querySelector('#modal-page-1');
        
        backButton.addEventListener('click', function modalPreviousPage () {
            modalBody.querySelector('#modal-page-1').classList.add('hidden');
            modalBody.querySelector('#modal-page-0').classList.remove('hidden');
            backButton.addEventListener('click', function signupBackButtonPressed () { showModal({type:'login'}) });
            backButton.removeEventListener('click', modalPreviousPage);
        });

        modalPage1.classList.remove('hidden');
        modalPage0.classList.add('hidden');
    });
}

function showReauthenticateModal () {
    closeModal();
    modal.classList.remove('hidden');
    modalHeader.innerHTML = `
        <button id="back-button" class="icon-button" type="button""><img src="./images/arrowleft.svg"></button>
        <div id="modal-title">パスワード再入力</div>
    `;
    modalBody.innerHTML = `
        <div class="field">
            <label for="password">パスワード</label>
            <input id="password" class="input" type="password" required>
        </div>
        <div class="buttons-group">
            <button class="submit-button" type="button">次へ</button>
        </div>
    `;

    const backButton = modalHeader.querySelector('#back-button');
    backButton.addEventListener('click', closeModal);

    const submitButton = modalBody.querySelector('.submit-button');

    return new Promise ( resolve => {
        submitButton.addEventListener('click', async function passwordReset () {
            const password = modalBody.querySelector('#password').value;
            const credential = EmailAuthProvider.credential(currentUser.email, password);
    
            await reauthenticateWithCredential(currentUser, credential).then(() => {
                resolve('resolved');
                closeModal();
            }).catch((error) => {
                showErrorDiv({text: 'パスワードが間違っています', element: modalBody.querySelector('#password')});
            });
        });
    });
}

function showMyAccountModal () {
    modalHeader.innerHTML = `
        <button id="back-button" class="icon-button" type="button""><img src="./images/arrowleft.svg"></button>
        <div id="modal-title">アカウント情報</div>
    `;

    modalBody.innerHTML = `
        <div id="display-image-container">
            <input id="change-display-image" type="file">
            <label for="change-display-image"><img class="display-image"></label>
        </div>
        <div class="field">
            <label for="name">氏名</label>
            <input class="input" type="text" id="name" required>
        </div>
        <div class="field">
            <label for="furigana">フリガナ</label>
            <input class="input" type="text" id="furigana" required>
        </div>
        <div class="field">
            <label for="email">メールアドレス</label>
            <input id="email" class="input" type="email" required>
        </div>
        <div class="select-field-group">
            <div class="field">
                <label for="course">クラス</label>
                <select id="course" class="input">
                    <option value="1-5">1-5</option>
                    <option value="1-6">1-6</option>
                    <option value="1-7">1-7</option>
                    <option value="1-8">1-8</option>
                    <option value="T2">T2</option>
                    <option value="R2">R2</option>
                    <option value="A2">A2</option>
                    <option value="W2">W2</option>
                    <option value="T3">T3</option>
                    <option value="R3">R3</option>
                    <option value="A3">A3</option>
                    <option value="W3">W3</option>
                    <option value="T4">T4</option>
                    <option value="R4">R4</option>
                    <option value="A4">A4</option>
                    <option value="W4">W4</option>
                    <option value="T5">T5</option>
                    <option value="R5">R5</option>
                    <option value="A5">A5</option>
                    <option value="W5">W5</option>
                </select>
            </div>
            <div class="field">
                <label for="part">パート</label>
                <select id="part" class="input">
                    <option value="未決定">未決定</option>
                    <option value="guitar">guitar</option>
                    <option value="bass">bass</option>
                    <option value="drums">drums</option>
                    <option value="keyboard">keyboard</option>
                    <option value="vocal">vocal</option>
                    <option value="PA">PA</option>
                </select>
            </div>
        </div>
        <div class="buttons-group">
            <button id="update-user-button" class="submit-button" type="button">編集</button>
        </div>
    `;

    const nameInput = modal.querySelector('#name');
    const furiganaInput = modal.querySelector('#furigana');
    const emailInput = modal.querySelector('#email');
    const courseInput = modal.querySelector('#course');
    const partInput = modal.querySelector('#part');

    nameInput.value = currentUserData['name'];
    furiganaInput.value = currentUserData['furigana'];
    emailInput.value = currentUserData['email'];
    courseInput.value = currentUserData['course'];
    partInput.value = currentUserData['part'];

    const displayImage = getDisplayImage(currentUserData['name'], 'users');
    const displayImageContainer = modal.querySelector('.display-image')
    displayImageContainer.setAttribute('src', displayImage);

    let chosenDisplayImage = undefined;
    const chosenDisplayFiles = modal.querySelector('#change-display-image');
    chosenDisplayFiles.addEventListener('change', async () => { 
        chosenDisplayImage = await changeDisplayImage(chosenDisplayFiles, displayImageContainer);
    });
    
    const backButton = modalHeader.querySelector('#back-button');
    backButton.addEventListener('click', closeModal);

    const updateUserButton = modalBody.querySelector('#update-user-button');
    updateUserButton.addEventListener('click', async () => {
        if ( !(!(usernameExists(nameInput.value)) || currentUserData['name'] == nameInput.value) ) { return showErrorDiv({text:'氏名は既に使われています', element: nameInput}); };

        await updateUser(chosenDisplayImage, nameInput.value, furiganaInput.value, courseInput.value, partInput.value, emailInput.value);
        window.location.reload();
    });
}

function showUserModal (name) {
    const userData = getDocByType(name, 'name', 'users').data();
    modalHeader.innerHTML = `
        <button id="back-button" class="icon-button" type="button""><img src="./images/arrowleft.svg"></button>
        <div id="modal-title">アカウント情報</div>
    `;

    const displayImage = getDisplayImage(name, 'users');
    modalBody.innerHTML = `
        <div id="display-image-container">
            <label for="change-display-image"><img src="${displayImage}" class="display-image"></label>
        </div>
        <div class="modal-page-buttons-group">
            <button id="basic-info-button" class="modal-page-button selected">基本情報</button>
            <button id="band-info-button" class="modal-page-button">バンド情報</button>
        </div>
        <div id="modal-page-0" class="modal-page">
            <div class="field">
                <label for="name">氏名</label>
                <div class="input" id="name">${userData['name']}</div>
            </div>
            <div class="field">
                <label for="furigana">フリガナ</label>
                <div class="input" id="furigana">${userData['furigana']}</div>
            </div>
            <div class="field">
                <label for="email">メールアドレス</label>
                <div id="email" class="input">${userData['email']}</div>
            </div>
            <div class="select-field-group">
                <div class="field">
                    <label for="course">クラス</label>
                    <div id="course" class="input">${userData['course']}</div>
                </div>
                <div class="field">
                    <label for="part">パート</label>
                    <div id="part" class="input">${userData['part']}</div>
                </div>
            </div>
        </div>
        <div id="modal-page-1" class="hidden modal-page">
            <div class="field">
                <label for="bands-container">所属バンド</label>
                <div id="bands-container" class="item-container"></div>
            </div>
        </div>
    `;

    const bandsContainer = modalBody.querySelector('#bands-container');
    loadBandItems({container: bandsContainer, bands: userData['bands']});

    const basicInfoButton = modalBody.querySelector('#basic-info-button');
    const bandInfoButton = modalBody.querySelector('#band-info-button');
    basicInfoButton.addEventListener('click', () => {
        modalBody.querySelector('#modal-page-0').classList.remove('hidden');
        modalBody.querySelector('#modal-page-1').classList.add('hidden');
        basicInfoButton.classList.add('selected');
        bandInfoButton.classList.remove('selected');
    })
    bandInfoButton.addEventListener('click', () => {
        modalBody.querySelector('#modal-page-0').classList.add('hidden');
        modalBody.querySelector('#modal-page-1').classList.remove('hidden');
        basicInfoButton.classList.remove('selected');
        bandInfoButton.classList.add('selected');
    })

    const backButton = modalHeader.querySelector('#back-button');
    backButton.addEventListener('click', closeModal);
}

function showBandModal (name) {
    const bandData = getDocByType(name, 'name', 'bands').data();
    modalHeader.innerHTML = `
        <button id="back-button" class="icon-button" type="button""><img src="./images/arrowleft.svg"></button>
        <div id="modal-title">バンド情報</div>
    `;

    const displayImage = getDisplayImage(name, 'bands');
    modalBody.innerHTML = `
        <div id="display-image-container">
            <label for="display-image"><img src="${displayImage}" class="display-image"></label>
        </div>
        <div class="field">
            <label for="name">バンド名</label>
            <div class="input" id="name">${bandData['name']}</div>
        </div>
        <div class="field">
            <label for="leader">代表者</label>
            <div class="input" id="leader">${bandData['leader']}</div>
        </div>
        <div class="field">
            <label for="member-container">メンバー</label>
            <div id="member-container" class="item-container"></div>
        </div>
        <div class="select-field-group">
    `;

    const membersContainer = modal.querySelector('#member-container');
    loadUserItems({container: membersContainer, users: bandData['members']});

    const backButton = modalHeader.querySelector('#back-button');
    backButton.addEventListener('click', closeModal);
}

async function showConfirmationModal ({message, action} = {}) {
    const modalBackdrop = document.createElement('div');
    modalBackdrop.setAttribute( 'id', 'modal-backdrop' );
    document.body.appendChild(modalBackdrop);

    modalHeader.innerHTML = `<div id="confirmation-message">${message}</div>`;

    modalBody.innerHTML = `
        <div class="buttons-group">
            <button id="cancel-button" class="submit-button" type="button">キャンセル</button>
            <button id="confirm-button" class="submit-button" type="button">${action}</button>
        </div>
    `;

    const confirmButton = modal.querySelector('#confirm-button');
    const cancelButton = modal.querySelector('#cancel-button');

    modal.classList.remove('hidden');
    modal.classList.add('fadeIn');
    window.setInterval( () => { modal.classList.remove('fadeIn') }, 210 );

    return new Promise ( resolve => {
        confirmButton.addEventListener('click', () => {
            closeModal();
            resolve('confirmed');
        })

        cancelButton.addEventListener('click', () => {
            closeModal();
            resolve('canceled');
        })
    });
}

/* アコーディオン関連 */
const accordion = document.querySelector('#accordion');
const accordionHeader = accordion.querySelector('#accordion-header');
const accordionBody = accordion.querySelector('#accordion-body');

function closeAccordion () {
    accordion.classList.add('unshow');
    pagesContainer.classList.add('unsqueeze');
    window.setTimeout( () => { 
        pagesContainer.classList.remove('unsqueeze');
        accordion.classList.add('hidden'); 
        accordion.classList.remove('unshow');
        accordionHeader.innerHTML = '';
        accordionBody.innerHTML = '';
    }, 210 )
}

function showAccordion ({type, data} = {}) {
    switch (type) {
        case 'createPost': showCreatePostAccordion(); break;
        case 'editPost': showEditPostAccordion(data); break;
        case 'post': showPostAccordion(data.postData, data.displayImage); break;
        case 'createBand': showCreateBandAccordion(); break;
        case 'editBand': showEditBandAccordion(data); break;
        case 'createReservation': showCreateReservationAccordion(); break;
    }
    
    accordion.classList.remove('hidden');
    accordion.classList.add('show');
    pagesContainer.classList.add('squeeze');
    window.setTimeout( () => { 
        accordion.classList.remove('show'); 
        pagesContainer.classList.remove('squeeze');
    }, 210 )
}

function showCreatePostAccordion () {
    accordionHeader.innerHTML = `
        <button id="back-button" class="icon-button" type="button"><img src="./images/exit.svg"></button>
        <button id="create-post-button" class="submit-button" type="button">投稿</button>
        <button id="accordion-kebab-menu" class="icon-button" type="button"><img src="./images/kebab.svg"></button>
    `;
    accordionBody.innerHTML = `
        <div class="field">
            <label for="type">種類</label>
            <select id="type" class="input">
                <option value="recruitment">バンド募集</option>
                <option value="notice">お知らせ</option>
            </select>
        </div>
        <div class="field">
            <label for="textarea details">詳細</label>
            <div id="details" class="input textarea" contenteditable="true" autocomplete="off"></div>
        </div>
    `;
    const backButton = accordionHeader.querySelector('#back-button');
    backButton.addEventListener('click', closeAccordion);

    const accordionKebabMenu = accordionHeader.querySelector('#accordion-kebab-menu');
    accordionKebabMenu.addEventListener('click', () => {
        showContextMenu({button: accordionKebabMenu, type: 'main'});
    });

    const createPostButton = accordionHeader.querySelector('#create-post-button');
    createPostButton.addEventListener('click', async () => {
        const type = accordionBody.querySelector('#type').value;
        const username = currentUserData['name'];
        const date = todaysDateString;
        const details = accordionBody.querySelector('#details').innerHTML;

        await createPost(type, username, date, details);
        loadHomePageData();
        closeAccordion();
    })
}

function showEditPostAccordion (doc) {
    accordionHeader.innerHTML = `
        <button id="back-button" class="icon-button" type="button"><img src="./images/exit.svg"></button>
        <button id="edit-post-button" class="submit-button" type="button">編集</button>
        <button id="accordion-kebab-menu" class="icon-button" type="button"><img src="./images/kebab.svg"></button>
    `;
    accordionBody.innerHTML = `
        <div class="field">
            <label for="textarea details">詳細</label>
            <div id="details" class="input textarea" contenteditable="true" autocomplete="off">${doc.data()['details']}</div>
        </div>
    `;
    const backButton = accordionHeader.querySelector('#back-button');
    backButton.addEventListener('click', closeAccordion);

    const accordionKebabMenu = accordionHeader.querySelector('#accordion-kebab-menu');
    accordionKebabMenu.addEventListener('click', () => {
        showContextMenu({button: accordionKebabMenu, type: 'main'});
    });

    const editPostButton = accordionHeader.querySelector('#edit-post-button');
    editPostButton.addEventListener('click', async () => {
        const details = accordionBody.querySelector('#details').innerHTML;

        console.log(doc.id);
        await updatePost(doc.id, details);
        loadHomePageData();
        closeAccordion();
    })
}

function showPostAccordion (postData, displayImage) {
    accordionHeader.innerHTML = `
        <button id="back-button" class="icon-button" type="button"><img src="./images/arrowleft.svg"></button>
        <button id="accordion-kebab-menu" class="icon-button" type="button"><img src="./images/kebab.svg"></button>
    `;
    accordionBody.innerHTML = `
        <div id="accordion-content-header">
            <button class="icon-button"><img src="${displayImage}" class="display-image"></button>
            <div>
                <div id="accordion-username">${postData['username']}</div>
                <div id="accordion-date">${postData['date']}</div>
            </div>
        </div>
        <div id="accordion-content-body">${postData['details']}</div>
    `;

    const accordionKebabMenu = accordionHeader.querySelector('#accordion-kebab-menu');
    accordionKebabMenu.addEventListener('click', () => {
        showContextMenu({button: accordionKebabMenu, type: 'main'});
    });

    const backButton = accordionHeader.querySelector('#back-button');
    backButton.addEventListener('click', closeAccordion);
}

function showCreateBandAccordion () {
    accordionHeader.innerHTML = `
        <button id="back-button" class="icon-button" type="button"><img src="./images/exit.svg"></button>
        <button id="create-band-button" class="submit-button" type="button">作成</button>
        <button id="accordion-kebab-menu" class="icon-button" type="button"><img src="./images/kebab.svg"></button>
    `;
    accordionBody.innerHTML = `
        <div id="display-image-container">
            <input id="change-display-image" type="file">
            <label for="change-display-image"><img class="display-image"></label>
        </div>
        <div class="field">
            <label for="name">バンド名</label>
            <input id="name" class="input" type="text" required>
        </div>
        <div class="field">
            <label for="leader">代表者</label>
            <select id="leader" class="input"></select>
        </div>
        <div class="field">
            <label for="members">メンバー</label>
            <div id="accordion-members-container"></div>
        </div>
        <div class="select-field-group">
            <select class="input" id="add-member-select"></select>
            <button id="add-member-button" class="submit-button" type="button">追加</button>
        </div>
    `;

    const backButton = accordionHeader.querySelector('#back-button');
    backButton.addEventListener('click', closeAccordion);

    const accordionKebabMenu = accordionHeader.querySelector('#accordion-kebab-menu');
    accordionKebabMenu.addEventListener('click', () => {
        showContextMenu({button: accordionKebabMenu, type: 'main'});
    });

    const membersSet = new Set();
    membersSet.add(currentUserData['name']);

    const displayImageContainer = accordionBody.querySelector('.display-image')
    displayImageContainer.setAttribute('src', './images/nodisplayimage.jpg');
    const nameInput = accordionBody.querySelector('#name');
    const leaderInput = accordionBody.querySelector('#leader');
    const membersContainer = accordionBody.querySelector('#accordion-members-container');
    const memberSelect = accordionBody.querySelector('#add-member-select');

    const usersArray = getArrayFromCollection(docs['users']);
    const memberOptionsFragement = new DocumentFragment();
    usersArray.forEach( user => {
        const option = document.createElement('option');
        option.setAttribute('value', user);
        option.innerHTML = user;

        memberOptionsFragement.appendChild(option);
    })
    memberSelect.appendChild(memberOptionsFragement);

    const changeLeaderOption = new MutationObserver( () => {
        const oldOptions = leaderInput.querySelectorAll('option');
        oldOptions.forEach( oldOption => {
            oldOption.remove();
        })

        const leaderOptionsFragement = new DocumentFragment();
        membersSet.forEach( member => {
            const option = document.createElement('option');
            option.setAttribute('value', member);
            option.innerHTML = member;

            leaderOptionsFragement.appendChild(option);
        })
        leaderInput.appendChild(leaderOptionsFragement);
    });
    changeLeaderOption.observe(membersContainer, { childList: true });

    loadUserItems({container: membersContainer, users: membersSet});

    const addMemberButton = accordionBody.querySelector('#add-member-button');
    addMemberButton.addEventListener('click', () => {
        membersSet.add(memberSelect.value);
        loadUserItems({container: membersContainer, users: membersSet});

        const removeMemberButtons = membersContainer.querySelectorAll('.remove-member-button');
        removeMemberButtons.forEach( removeMemberButton => {
            const memberName = removeMemberButton.parentNode.querySelector('.item-name').innerHTML
            removeMemberButton.addEventListener('click', (event) => {
                event.stopPropagation();
                membersSet.delete(memberName);
                removeMemberButton.parentNode.remove();
            });
        });
    })

    let chosenDisplayImage = undefined;
    const chosenDisplayFiles = accordionBody.querySelector('#change-display-image');
    chosenDisplayFiles.addEventListener('change', async () => {
        chosenDisplayImage = await changeDisplayImage(chosenDisplayFiles, displayImageContainer);
    });

    const createBandButton = accordionHeader.querySelector('#create-band-button');
    createBandButton.addEventListener('click', async () => {

        if ( bandnameExists(nameInput.value) ) { return showErrorDiv({text: 'バンド名は既に使われています', element: nameInput}) };

        await createBand(nameInput.value, membersSet, leaderInput.value, chosenDisplayImage);
        closeAccordion();
        loadMemberPageData();
    });
}

function showEditBandAccordion (doc) {
    accordionHeader.innerHTML = `
        <button id="back-button" class="icon-button" type="button"><img src="./images/exit.svg"></button>
        <button id="edit-band-button" class="submit-button" type="button">編集</button>
        <button id="accordion-kebab-menu" class="icon-button" type="button"><img src="./images/kebab.svg"></button>
    `;
    accordionBody.innerHTML = `
        <div id="display-image-container">
            <input id="change-display-image" type="file">
            <label for="change-display-image"><img class="display-image"></label>
        </div>
        <div class="field">
            <label for="name">バンド名</label>
            <input id="name" class="input" type="text" required>
        </div>
        <div class="field">
            <label for="leader">代表者</label>
            <select id="leader" class="input"></select>
        </div>
        <div class="field">
            <label for="members">メンバー</label>
            <div id="accordion-members-container"></div>
        </div>
        <div class="select-field-group">
            <select class="input" id="add-member-select"></select>
            <button id="add-member-button" class="submit-button" type="button">追加</button>
        </div>
    `;

    const backButton = accordionHeader.querySelector('#back-button');
    backButton.addEventListener('click', closeAccordion);

    const accordionKebabMenu = accordionHeader.querySelector('#accordion-kebab-menu');
    accordionKebabMenu.addEventListener('click', () => {
        showContextMenu({button: accordionKebabMenu, type: 'main'});
    });

    const bandData = doc.data();

    const membersSet = new Set(bandData['members']);

    const nameInput = accordionBody.querySelector('#name');
    const leaderInput = accordionBody.querySelector('#leader');
    const membersContainer = accordionBody.querySelector('#accordion-members-container');
    const memberSelect = accordionBody.querySelector('#add-member-select');

    const usersArray = getArrayFromCollection(docs['users']);
    const memberOptionsFragement = new DocumentFragment();
    usersArray.forEach( user => {
        const option = document.createElement('option');
        option.setAttribute('value', user);
        option.innerHTML = user;

        memberOptionsFragement.appendChild(option);
    })
    memberSelect.appendChild(memberOptionsFragement);

    const changeLeaderOption = new MutationObserver( () => {
        const oldOptions = leaderInput.querySelectorAll('option');
        oldOptions.forEach( oldOption => {
            oldOption.remove();
        })

        const leaderOptionsFragement = new DocumentFragment();
        membersSet.forEach( member => {
            const option = document.createElement('option');
            option.setAttribute('value', member);
            option.innerHTML = member;

            leaderOptionsFragement.appendChild(option);
        })
        leaderInput.appendChild(leaderOptionsFragement);
    });
    changeLeaderOption.observe(membersContainer, { childList: true });

    loadUserItems({container: membersContainer, users: membersSet});
    const removeMemberButtons = membersContainer.querySelectorAll('.remove-member-button');
    removeMemberButtons.forEach( removeMemberButton => {
        const memberName = removeMemberButton.parentNode.querySelector('.item-name').innerHTML
        removeMemberButton.addEventListener('click', (event) => {
            event.stopPropagation();
            membersSet.delete(memberName);
            removeMemberButton.parentNode.remove();
        });
    });

    nameInput.value = bandData['name'];
    leaderInput.value = bandData['leader'];

    const addMemberButton = accordionBody.querySelector('#add-member-button');
    addMemberButton.addEventListener('click', () => {
        membersSet.add(memberSelect.value);
        loadUserItems({container: membersContainer, users: membersSet});

        const removeMemberButtons = membersContainer.querySelectorAll('.remove-member-button');
        removeMemberButtons.forEach( removeMemberButton => {
            const memberName = removeMemberButton.parentNode.querySelector('.item-name').innerHTML
            removeMemberButton.addEventListener('click', (event) => {
                event.stopPropagation();
                membersSet.delete(memberName);
                removeMemberButton.parentNode.remove();
            });
        });
    })

    const displayImage = getDisplayImage(bandData['name'], 'bands');
    const displayImageContainer = accordionBody.querySelector('.display-image');
    displayImageContainer.setAttribute('src', displayImage);

    let chosenDisplayImage = undefined;
    const chosenDisplayFiles = accordionBody.querySelector('#change-display-image');
    chosenDisplayFiles.addEventListener('change', async () => {
        chosenDisplayImage = await changeDisplayImage(chosenDisplayFiles, displayImageContainer);
    });

    const editBandButton = accordionHeader.querySelector('#edit-band-button');
    editBandButton.addEventListener('click', async () => {
        if ( !(!(bandnameExists(nameInput.value)) || bandData['name'] == nameInput.value) ) { return showErrorDiv({text:'バンド名は既に使われています', element: nameInput}); };

        await updateBand(doc.id, nameInput.value, membersSet, leaderInput.value, chosenDisplayImage);
        loadMemberPageData();
        closeAccordion();
    });
}

function showCreateReservationAccordion () {
    accordionHeader.innerHTML = `
        <button id="back-button" class="icon-button" type="button"><img src="./images/exit.svg"></button>
        <button id="create-reservation-slot-button" class="submit-button" type="button">追加</button>
        <button id="accordion-kebab-menu" class="icon-button" type="button"><img src="./images/kebab.svg"></button>
    `;
    accordionBody.innerHTML = `
        <div class="field"><label for="date">期間</label></div>
        <div class="select-field-group">
            <div class="field">
                <label for="start-date">開始日</label>
                <input id="start-date" class="input" type="date">
            </div>
            <div class="field">
                <label for="end-date">終了日</label>
                <input id ="end-date" class="input" type="date">
            </div>
        </div>
        <div class="field">
            <label for="timeslots-container">時刻</label>
            <div id="timeslots-container" class="item-container"></div>
        </div>
        <div class="select-field-group">
            <div class="field">
                <label for="start-time">開始時間</label>
                <input id="start-time" class="input" type="time">
            </div>
            <div class="field">
                <label for="end-time">終了時間</label>
                <input id="end-time" class="input" type="time">
            </div>
            <button id="add-timeslot-button" class="submit-button" type="button">時刻追加</button>
        </div>
    `;

    const backButton = accordionHeader.querySelector('#back-button');
    backButton.addEventListener('click', closeAccordion);

    const accordionKebabMenu = accordionHeader.querySelector('#accordion-kebab-menu');
    accordionKebabMenu.addEventListener('click', () => { showContextMenu({button: accordionKebabMenu, type: 'main'}); });

    const timeSlotsContainer = accordionBody.querySelector('#timeslots-container');
    const timeSlotSet = new Set();
    const addTimeslotButton = accordionBody.querySelector('#add-timeslot-button');
    addTimeslotButton.addEventListener('click', () => {
        let startTime = accordionBody.querySelector('#start-time').value;
        let endTime = accordionBody.querySelector('#end-time').value;

        accordionBody.querySelector('#start-time').value = endTime;

        const timeSlotDiv = document.createElement('div');
        timeSlotDiv.classList.add('item')
        timeSlotDiv.innerHTML = `
            <div class="item-name">${startTime} - ${endTime}</div>
            <button class="icon-button remove-timeslot-button" type="button"><img src="./images/exit.svg"></img></button>
        `;

        startTime = startTime.replace(':','');
        endTime = endTime.replace(':','');

        const startEndTime = `${startTime}-${endTime}`;
        timeSlotSet.add(startEndTime);

        const removeTimeslotButton = timeSlotDiv.querySelector('.remove-timeslot-button');
        removeTimeslotButton.addEventListener('click', () => {
            timeSlotDiv.remove();
            timeSlotSet.delete(startEndTime);
        })

        timeSlotsContainer.appendChild(timeSlotDiv);
    })

    const createReservationSlotButton = accordionHeader.querySelector('#create-reservation-slot-button');
    createReservationSlotButton.addEventListener('click', () => {
        const startDate = accordionBody.querySelector('#start-date').value;
        const endDate = accordionBody.querySelector('#end-date').value;

        createReservationSlot(startDate, endDate, Array.from(timeSlotSet));
    })
}

/* アプリ初期化 */

let currentUser = undefined;
let currentUserData = undefined;
const todaysDateObject = new Date();
const todaysDateString = `${todaysDateObject.getFullYear()}-${('00' + (todaysDateObject.getMonth() + 1)).slice(-2)}-${('00' + todaysDateObject.getDate()).slice(-2)}`

const topNav = document.querySelector('#top-nav');
const bottomNav = document.querySelector('#bottom-nav');

const myAccountButton = topNav.querySelector('#my-account-button');
myAccountButton.addEventListener('click', () => { showModal({type: 'myAccount'}); });

const mainKebabMenu = topNav.querySelector('#main-kebab-menu');
mainKebabMenu.addEventListener('click', () => {
    showContextMenu({button: mainKebabMenu, type: 'main'});
});

await onAuthStateChanged(auth, async (user) => {
    await getFirebaseDocs('users');
    if (user) {
        currentUser = user;
        currentUserData = await getDocByType(currentUser.uid, 'id', 'users').data();

        await getFirebaseDocs('posts');
        await getFirebaseDocs('bands');
        await getFirebaseDocs('reservations');

        topNav.classList.remove('hidden');
        bottomNav.classList.remove('hidden');

        const displayImageContainer = topNav.querySelector('.display-image');
        const displayImage = getDisplayImage(currentUserData['name'], 'users');
        displayImageContainer.setAttribute('src', displayImage);

        pagesContainer.classList.remove('hidden');
        document.querySelector('#accordion-buttons-container').classList.remove('hidden');
        loadHomePageData();

        const postBody = page['home'].querySelector('.post-body');
        if ( postBody !== null ) {
            const postBodyHeight = getSize(postBody).height;
            const lineToClamp = Math.floor(postBodyHeight/16);
            const hideLineHeight = postBodyHeight%16;
            document.documentElement.style.setProperty('--post-line-clamp', lineToClamp);
            document.documentElement.style.setProperty('--hide-line-height', `${hideLineHeight}px`);
        }

        if( currentUserData['isAdmin'] === true ) {
            if ( document.querySelector('#reservation-accordion-btton') === null ) { 
                const reservationAccordionButton = document.createElement('button');
                reservationAccordionButton.setAttribute('id', 'reservation-accordion-button');
                reservationAccordionButton.classList.add('accordion-button', 'hidden');
                reservationAccordionButton.innerHTML = `<img src="./images/plus.svg">`;

                reservationAccordionButton.addEventListener('click', () => { showAccordion({type: 'createReservation'}); });

                document.querySelector('#accordion-buttons-container').appendChild(reservationAccordionButton);
                accordionButton['reservation'] = reservationAccordionButton;
            }
        };
    } else {
        showModal({type:'login'});
    }
});