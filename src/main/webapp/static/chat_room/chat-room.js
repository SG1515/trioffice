var stompClient = null;
var currentSubscription = null;
var currentChatRoomId = null;
var currentEmployeeId = null;
var previousSenderId = null;
var timeoutId = null;
var currentMessageId = null;
var offset = 0; // 현재 로드된 메시지의 수
var limit = 50; // 한 번에 로드할 메시지 수
var hasMoreData = true; // 더 로드할 데이터가 있는지 확인
var loading = false; // AJAX 로드 중복 실행 방지
let dropzoneInitialized = false;
let myDropzone = null
let reconnectInterval = 5000; // 재연결 간격 (밀리초 단위)
let reconnectAttempts = 0;
let maxReconnectAttempts = 10;



$(document).ready(function() {
    handleChatRoomListUpdate();

    // 유저 정보 로드
    $.ajax({
        url: '/api/current-employee',
        method: 'GET',
        dataType: 'json',
        success: function (data) {
            currentEmployeeId = data.employeeId;

            connectChatRoomListSocket();
        },
        error: function (xhr, status, error) {
            console.error('유저 정보를 가져오는 데 실패했습니다:', error);
        }
    });

    function connectChatRoomListSocket() {
        if (stompClient && stompClient.connected) {
            console.log("이미 STOMP 클라이언트가 연결되어 있습니다.");
            return;
        }
        var sockJs = new SockJS("/stomp/connection");
        stompClient = Stomp.over(sockJs);
        stompClient.debug = null; // 디버그 로그 비활성화

        stompClient.connect({}, function () {
            console.log("WebSocket 연결 성공");
            reconnectAttempts = 0; // 재연결 성공 시 재연결 횟수 초기화
            subscribeToChatRoomList();

            // 재연결 후 현재 채팅방이 열려 있으면 다시 구독
            if (currentChatRoomId) {
                console.log("재연결 후 채팅방 구독을 재설정합니다:", currentChatRoomId);
                subscribeToChatRoom(currentChatRoomId);
            }
        }, function (error) {
            console.error("WebSocket 연결 에러:", error);
            reconnectWebSocket();
        });

        // 연결 종료 이벤트 처리
        stompClient.ws.onclose = function() {
            console.log("WebSocket 연결이 종료되었습니다.");
            reconnectWebSocket();
        };
    }

    function reconnectWebSocket() {
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log("WebSocket 연결이 끊어졌습니다. " + reconnectAttempts + "번째 재연결을 시도합니다...");
            setTimeout(function () {
                connectChatRoomListSocket();
            }, reconnectInterval);
        } else {
            console.error("재연결 횟수 초과로 인해 더 이상 재연결을 시도하지 않습니다.");
        }
    }

    function subscribeToChatRoomList() {
        stompClient.subscribe("/sub/chatrooms/employees/" + currentEmployeeId, function (message) {
            var receivedMessage = JSON.parse(message.body);
            $('.favor-box').hasClass('inactive-box') ? handleChatRoomListUpdate() : handleFavorChatRoomListUpdate();
        });
    }

    function handleChatRoomListUpdate() {

        // ajax 요청을 통해 채팅방 정보 가져오기
        $.ajax({
            url: '/api/chatrooms',
            method: 'GET',
            dataType: 'json',
            success: function (data) {
                console.log(data);
                updateChatRoomList(data);
                updateDateFormat();
            },
            error: function (xhr, status, error) {
                console.error('채팅방 정보를 가져오는 데 실패했습니다:', error);
            }
        });
    }

    function updateChatRoomList(chatRooms) {

        var chatRoomsList = $('.chat-rooms-list');
        chatRoomsList.empty();

        chatRooms.forEach(function (chatRoom) {
            var chatRoomItem = `
            <div class="row chat-room chat-room-item justify-content-between" data-chat-room-id="${chatRoom.chatRoomId}" data-is-favorited="${chatRoom.isFavorited}">
                <div class="col-3">
                    <div class="profile">
                        <img src="${chatRoom.chatRoomProfileImageUrl}" />
                        ` + addProfileStatus(chatRoom.employeeStatus) + `
                    </div>
                </div>
                <div class="col-8 d-flex align-content-between flex-wrap no-padding-left">
                    <div class="row d-flex justify-content-between name-time-box">
                        <div class="col-8 no-padding-left">
                            <div class="chat-room-name">
                                <p class="group-name">${chatRoom.chatRoomName}</p>
                            </div>
                        </div>
                        <div class="col-4">
                            <div class="last-message-at sub-text">
                                <p>${chatRoom.lastMessageTime}</p>
                            </div>
                        </div>
                        
                    </div>
                    <div class="row w-100 d-flex justify-content-between align-items-end">
                        <div class="col-9 no-padding-left">
                            <div class="chat-room-last-message sub-text">
                                <p>${chatRoom.lastMessage}</p>
                            </div>
                        </div>`
                + addUnReadMessage(chatRoom) + `
                    </div>
                </div>
            </div>`;
            chatRoomsList.append(chatRoomItem);
            addChatRoomActive(chatRoom);
        });

        console.log(initialChatRoomId);

        if (currentChatRoomId == null && chatRooms.length > 0) {
            var chatRoomIdToOpen = initialChatRoomId;

            // 해당 chatRoomId를 가진 채팅방 아이템을 찾습니다.
            var chatRoomItem = $('.chat-room-item[data-chat-room-id="' + chatRoomIdToOpen + '"]');
            console.log(chatRoomItem);
            if (chatRoomItem.length > 0) {
                chatRoomItem.trigger('click');
                $('.default-contents').hide()
                $('.chat-contents').show();
            }
        }
    }

    function addUnReadMessage(chatRoom) {
        if (chatRoom.unreadMessageCount > 0) {
            return `<div class="col-3 text-end">
                        <div class="unread-count-box">
                            <p class="unread-count">${chatRoom.unreadMessageCount}</p>
                        </div>
                    </div>`;
        }
        return ''
    }

    function addProfileStatus(status) {
        console.log(status);
        if (status == 1) {
            return `<div class="status d-flex justify-content-center align-items-center">
                        <i class="fa-solid fa-check check-icon"></i>
                    </div>`;
        } else if(status == 2) {
            return `<div class="absent-status d-flex justify-content-center align-items-center">
                        <i class="fa-solid fa-minus"></i>
                    </div>`;
        } else if (status == 3) {
            return `<div class="inactive-status d-flex justify-content-center align-items-center">
                        <i class="fa-solid fa-minus"></i>
                    </div>`;
        } else if (status == 4) {
            return `<div class="dnd-status d-flex justify-content-center align-items-center">
                        <i class="fa-solid fa-minus"></i>
                    </div>`;
        }
        return '';
    }

    function addChatRoomActive(chatRoom) {
        console.log(chatRoom.chatRoomId);
        console.log(currentChatRoomId);
        if (chatRoom.chatRoomId == currentChatRoomId) {
            $('.chat-room-item').each(function () {
                if ($(this).data('chat-room-id') == chatRoom.chatRoomId) {
                    $(this).addClass('active');
                } else {
                    $(this).removeClass('active');
                }
            });
        }
    }

    // 채팅방 아이템 클릭 이벤트 등록
    $('.chat-rooms-list').on('click', '.chat-room-item', function () {
        console.log('채팅방 클릭 이벤트 발생');
        var chatRoomId = $(this).data('chat-room-id');

        $('.chat-room-item').removeClass('active');
        $(this).addClass('active');


        $('.chat-area').show();
        $('.file-area').hide();
        $('.image-area').hide();
        $('.chat-button').addClass('active');
        $('.file-button').removeClass('active');
        $('.image-button').removeClass('active');


        connectWebSocket(chatRoomId);
        loadChatRoom(chatRoomId);

        // 채팅방 아이템 클릭 시 클릭한 .chat-room-item의 unreadMessageCount 초기화
        $(this).find('.unread-count-box').remove();
        initFileTagify()
        initializeDropzone();

    });

    // 메시지 전송 이벤트
    $('#send').on('click', sendMessage);
    $('.chat-input').keypress(function (event) {
        if (event.keyCode === 13) {
            event.preventDefault();
            sendMessage();
        }
    });

    function sendMessage() {
        var chatContents = $('.chat-input').val().trim();
        if (chatContents === '') return;

        var chatMessage = {
            roomId: currentChatRoomId,
            senderId: currentEmployeeId,
            chatType: 2,
            message: chatContents
        };

        if (stompClient && stompClient.connected) {
            stompClient.send("/pub/chat/send", {}, JSON.stringify(chatMessage));
            $('.chat-input').val('');
        } else {
            console.error('WebSocket이 연결되어 있지 않습니다.');
        }
    }

    function loadChatRoom(chatRoomId) {
        offset = 0;
        limit = 50;
        hasMoreData = true;

        $.ajax({
            url: '/api/chatrooms/' + chatRoomId,
            method: 'GET',
            dataType: 'json',
            data: {offset: offset, limit: limit},
            success: function (data) {
                if (data.chatInfoList.length < limit) {
                    hasMoreData = false; // 모든 데이터 로드 완료
                }

                console.log(data)
                updateChatRoomInfo(data);
                updateChatContents(data.chatInfoList);
                offset += data.chatInfoList.length; // 오프셋 업데이트
                loading = false;
            },
            error: function (xhr, status, error) {
                console.error('채팅방 데이터를 가져오는 데 실패했습니다:', error);
            }
        });
    }

    function updateChatRoomInfo(data) {
        $('.contents .group-name').text(data.chatRoomName);
        $('.chat-room-profile-image').attr('src', data.chatRoomProfileImageUrl);
        console.log(data);

        console.log(data.participantCount)
        $('.emp-count').text(data.participantCount);
    }

    function updateChatContents(messages) {
        var chatContainer = $('.chat-container');
        chatContainer.empty();
        previousSenderId = null;

        messages.reverse().forEach(function (message) {
            var chatRow = generateMessageHtml(message);
            chatContainer.append(chatRow); // Append messages to the bottom
        });

        // Scroll to the bottom to show the latest messages
        let chat = $('.chat');
        chat.scrollTop(chat.prop('scrollHeight'));
    }

    function addChatContents(messages) {
        var chatContainer = $('.chat-container');
        var chat = $('.chat');

        // 스크롤 위치와 높이를 저장합니다.
        var previousScrollHeight = chat.prop('scrollHeight');
        var previousScrollTop = chat.scrollTop();

        // Prepend older messages to the top
        messages.forEach(function (message) {
            var chatRow = generateMessageHtml(message);
            chatContainer.prepend(chatRow);
        });

        // Adjust scroll position to maintain view
        var newScrollHeight = chat.prop('scrollHeight');
        chat.scrollTop(newScrollHeight - previousScrollHeight + previousScrollTop);
    }

    function generateMessageHtml(message) {
        var isSameSender = (message.senderId === previousSenderId);
        if (message.chatType === "CHAT" || message.chatType === "FILE" || message.chatType === "IMAGE") {
            previousSenderId = message.senderId;
        }
        var chatRow;

        if (message.chatType === "ENTER") {
            console.log('ENTER 메시지');
            chatRow = createEnterAndQuitMessage(message);
        } else if (message.chatType === "CHAT") {
            if (message.senderId === currentEmployeeId) {
                chatRow = createMyMessageHtml(message);
            } else {
                chatRow = createOtherMessageHtml(message, isSameSender);
            }
        } else if (message.chatType === "QUIT") {
            //count 감소
            chatRow = createEnterAndQuitMessage(message);
        } else if (message.chatType === "FILE") {
            if (message.senderId === currentEmployeeId) {
                chatRow = createMyFileMessageHtml(message);
            } else {
                chatRow = createOtherFileMessageHtml(message, isSameSender);
            }
        } else if (message.chatType === "IMAGE") {
            if (message.senderId === currentEmployeeId) {
                chatRow = createMyImageMessageHtml(message);
            } else {
                chatRow = createOtherImageMessageHtml(message, isSameSender);
            }
        }

        return chatRow;
    }

    function createOtherFileMessageHtml(message, isSameSender) {
        var profileHtml = isSameSender ? `
            <div class="col-1"></div>` : `
            <div class="col-1">
                <div class="chat-profile">
                    <img src="${message.senderProfileUrl}" />
                </div>
            </div>`;

        var nameHtml = isSameSender ? '' : `
            <div class="row d-flex justify-content-end">
                <div class="col-11 emp-name d-flex justify-content-start">
                    <span>${message.senderName}</span>
                </div>
            </div>`;

        var emoticonHtml = createEmoticonBoxHtml(message);

        return `
        <div class="row" data-message-id="${message.chatId}">
            <div class="col-10 add-emoticon-point">
                ${nameHtml}
                <div class="row">
                    ${profileHtml}
                    <div class="col-9">
                        <div class="chat-bubble-container d-flex align-items-end">
                            <div class="chat-content d-flex align-items-center justify-content-center">
                                <div class="file-box">
                                    <div class="row d-flex justify-content-between  align-items-center">
                                        <div class="col-10">
                                            <p>${message.chatContents}</p>
                                            <div class="row">
                                                <div class="tag-box">
                                                    ${createTagBoxHtml(message)}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="col-2">
                                            <i class="fa-solid fa-download"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="chat-time">
                                ${formatDate(message.chatTime)}
                            </div>
                            <div class="unread-count-box">
                                    <span class="unread-count">${createUnreadCountHtml(message.unreadMessageCount)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                ${emoticonHtml}
            </div>
        </div>`;
    }

    function createOtherImageMessageHtml(message, isSameSender) {
        var profileHtml = isSameSender ? `
            <div class="col-1"></div>` : `
            <div class="col-1">
                <div class="chat-profile">
                    <img src="${message.senderProfileUrl}" data-chat-id="${message.chatId}" />
                </div>
            </div>`;

        var nameHtml = isSameSender ? '' : `
            <div class="row d-flex justify-content-end">
                <div class="col-11 emp-name d-flex justify-content-start">
                    <span>${message.senderName}</span>
                </div>
            </div>`;

        var emoticonHtml = createEmoticonBoxHtml(message);

        return `
        <div class="row" data-message-id="${message.chatId}">
            <div class="col-10 add-emoticon-point">
                ${nameHtml}
                <div class="row">
                    ${profileHtml}
                    <div class="col-9">
                        <div class="chat-bubble-container d-flex align-items-end">
                            <div class="chat-content d-flex align-items-center justify-content-center">
                                <div class="file-box">
                                    <div class="row d-flex justify-content-between  align-items-center">
                                        <div class="col-12">
                                            <img src="${message.chatContents}" alt="사진" class="chat-image" data-chat-id="${message.chatId}"/>
                                            <div class="row">
                                                <div class="tag-box">
                                                    ${createTagBoxHtml(message)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="chat-time">
                                ${formatDate(message.chatTime)}
                            </div>
                            <div class="unread-count-box">
                                    <span class="unread-count">${createUnreadCountHtml(message.unreadMessageCount)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                ${emoticonHtml}
            </div>
        </div>`;
    }

    function createMyImageMessageHtml(message) {
        return `<div class="row d-flex justify-content-end" data-message-id="${message.chatId}">
            <div class="col-10 add-emoticon-point">
                <div class="row d-flex justify-content-end">
                    <div class="col-9">
                        <div class="chat-bubble-container d-flex align-items-end justify-content-end">
                            <div class="unread-count-box">
                                <span class="unread-count">${createUnreadCountHtml(message.unreadMessageCount)}</span>
                            </div>
                            <div class="my-chat-time">
                                ${formatDate(message.chatTime)}
                            </div>
                            <div class="my-chat-content d-flex align-items-center justify-content-center">
                                <div class="file-box">
                                    <div class="row d-flex justify-content-between  align-items-center">
                                        <div class="col-12">
                                            <img src="${message.chatContents}" alt="사진" class="chat-image" data-chat-id="${message.chatId}"/>
                                            <div class="row">
                                                <div class="tag-box">
                                                    ${createTagBoxHtml(message)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                ${createMyEmoticonBoxHtml(message)}
            </div>
        </div>`;
    }

    function createTagBoxHtml(message) {
        if (!message.tags) {
            return '';
        }

        var tagHtml = '<i class="fa-solid fa-tag"></i>';
        message.tags.forEach(function (tag) {
            tagHtml += `<span class="tag">${tag}</span>`;
        });
        return tagHtml;
    }

    function createMyFileMessageHtml(message) {
        return `<div class="row d-flex justify-content-end" data-message-id="${message.chatId}">
            <div class="col-10 add-emoticon-point">
                <div class="row d-flex justify-content-end">
                    <div class="col-9">
                        <div class="chat-bubble-container d-flex align-items-end justify-content-end">
                            <div class="unread-count-box">
                                <span class="unread-count">${createUnreadCountHtml(message.unreadMessageCount)}</span>
                            </div>
                            <div class="my-chat-time">
                                ${formatDate(message.chatTime)}
                            </div>
                            <div class="my-chat-content d-flex align-items-center justify-content-center">
                                <div class="file-box">
                                    <div class="row d-flex justify-content-between  align-items-center">
                                        <div class="col-10">
                                            <p>${message.chatContents}</p>
                                            <div class="row">
                                                <div class="tag-box">
                                                    ${createTagBoxHtml(message)}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="col-2">
                                            <i class="fa-solid fa-download"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                ${createMyEmoticonBoxHtml(message)}
            </div>
        </div>`;
    }

    function createMyMessageHtml(message) {
        return `
        <div class="row d-flex justify-content-end" data-message-id="${message.chatId}">
            <div class="col-10 add-emoticon-point">
                <div class="row d-flex justify-content-end">
                    <div class="col-9">
                        <div class="chat-bubble-container d-flex align-items-end justify-content-end">
                            <div class="unread-count-box">
                                    <span class="unread-count">${createUnreadCountHtml(message.unreadMessageCount)}</span>
                            </div>
                            <div class="my-chat-time">
                                ${formatDate(message.chatTime)}
                            </div>
                            <div class="my-chat-content d-flex align-items-center justify-content-center">
                                <p>${message.chatContents}</p>
                            </div>
                        </div>
                    </div>
                </div>
                ${createMyEmoticonBoxHtml(message)}
            </div>
        </div>`;
    }

    function createOtherMessageHtml(message, isSameSender) {
        var profileHtml = isSameSender ? `
            <div class="col-1"></div>` : `
            <div class="col-1">
                <div class="chat-profile">
                    <img src="${message.senderProfileUrl}" />
                </div>
            </div>`;

        var nameHtml = isSameSender ? '' : `
            <div class="row d-flex justify-content-end">
                <div class="col-11 emp-name d-flex justify-content-start">
                    <span>${message.senderName}</span>
                </div>
            </div>`;

        var emoticonHtml = createEmoticonBoxHtml(message);

        return `
        <div class="row" data-message-id="${message.chatId}">
            <div class="col-10 add-emoticon-point">
                ${nameHtml}
                <div class="row">
                    ${profileHtml}
                    <div class="col-9">
                        <div class="chat-bubble-container d-flex align-items-end">
                            <div class="chat-content d-flex align-items-center justify-content-center">
                                <p>${message.chatContents}</p>
                            </div>
                            <div class="chat-time">
                                ${formatDate(message.chatTime)}
                            </div>
                            <div class="unread-count-box">
                                    <span class="unread-count">${createUnreadCountHtml(message.unreadMessageCount)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                ${emoticonHtml}
            </div>
        </div>`;
    }

    function createEmoticonBoxHtml(message) {
        var emoticons = createEmoticonButton(message);
        if (emoticons) {
            return `
            <div class="row d-flex align-items-start emoticon-boxes">
                <div class="blank"></div>
                <div class="emoticon-box">
                    ${emoticons}
                </div>
            </div>`;
        }
        return '';
    }


    function createMyEmoticonBoxHtml(message) {
        var emoticons = createEmoticonButton(message);
        if (emoticons) {
            return `
            <div class="row d-flex align-items-start justify-content-end emoticon-boxes">
                <div class="blank"></div>
                <div class="emoticon-box justify-content-end">
                    ${emoticons}
                </div>
            </div>`;
        }
        return '';

    }

    function createUnreadCountHtml(count) {
        return count > 0 ? `<span class="unread-count">${count}</span>` : '';
    }

    function createEnterAndQuitMessage(message) {
        return `
        <div class="row chat-one">
                <div class="col-10">
                    <div class="row">
                        <div class="col-1 d-flex justify-content-end">
                            <div class="add-chat-profile">
                            ` + getIconByEnterAndQuit(message) + `
                            </div>
                        </div>
                        <div class="col-9">
                            <div class="chat-bubble-container d-flex align-items-end">
                                <div
                                        class="d-flex align-items-center justify-content-center"
                                >
                                    <p>${message.chatContents}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    function getIconByEnterAndQuit(message) {
        if (message.chatType === "ENTER") {
            return `<i class="fa-solid fa-user-plus"></i>`;
        } else if (message.chatType === "QUIT") {
            return `<i class="fa-solid fa-user-minus"></i>`;
        }
    }

    function connectWebSocket(chatRoomId) {
        currentChatRoomId = chatRoomId; // 현재 채팅방 ID 저장

        if (!stompClient || !stompClient.connected) {
            console.error("STOMP 클라이언트가 연결되어 있지 않습니다. 재연결을 시도합니다...");
            reconnectWebSocket();
            return;
        }

        // 이전 구독 해제
        if (currentSubscription) {
            try {
                currentSubscription.unsubscribe();
                console.log("이전 채팅방 구독을 해제했습니다.");
            } catch (e) {
                console.error("구독 해제 중 오류 발생:", e);
            }
        }

        subscribeToChatRoom(chatRoomId);
        console.log("채팅방에 연결되었습니다:", chatRoomId);
    }

    function subscribeToChatRoom(chatRoomId) {
        currentSubscription = stompClient.subscribe("/sub/chat/room/" + chatRoomId, function (message) {
            console.log(message.body);
            var receivedMessage = JSON.parse(message.body);
            if (receivedMessage.chatType === "CHAT" || receivedMessage.chatType === "FILE" || receivedMessage.chatType === "IMAGE") {
                // 채팅 메시지 처리
                addMessage(receivedMessage);
            } else if (receivedMessage.chatType === 'EMOTICON') {
                // 이모티콘 반응 처리
                updateEmoticon(receivedMessage);
            } else if (receivedMessage.chatType === "ENTER") {
                // 채팅방 참여자 처리
                $('.emp-count').text(parseInt($('.emp-count').text()) + 1);

                // 채팅방 이미지 변경
                $('.chat-room-profile-image').attr('src', "https://us.123rf.com/450wm/siamimages/siamimages1703/siamimages170303374/74232239-%EA%B7%B8%EB%A3%B9-%EC%82%AC%EB%9E%8C-%EC%95%84%EC%9D%B4%EC%BD%98.jpg");

                addEnterMessage(receivedMessage);
            } else if (receivedMessage.chatType === "QUIT") {
                // 채팅방 나간 참여자 처리
                $('.emp-count').text(parseInt($('.emp-count').text()) - 1);
                addEnterMessage(receivedMessage);
            } else if (receivedMessage.chatType === "READ") {
                // 읽음 처리
                console.log('읽음 처리:', receivedMessage);
                readMessage(receivedMessage);
            } else if (receivedMessage.chatType === "DELETE") {
                // 삭제 처리
                console.log('삭제 처리:', receivedMessage);
                deleteMessage(receivedMessage);
            }
        }, function (error) {
            console.error("채팅방 구독 중 에러 발생:", error);
            if (stompClient && stompClient.connected) {
                console.log("채팅방에 재구독을 시도합니다...");
                subscribeToChatRoom(chatRoomId);
            } else {
                reconnectWebSocket();
            }
        });
    }

    function deleteMessage(receivedMessage) {
        // receivedMessage.chatId 값으로 해당 메시지 contents를 삭제된 메세지입니다. 로 변경
        var messageRow = $('.chat .row[data-message-id="' + receivedMessage.chatId + '"]');
        if (messageRow.length === 0) {
            return;
        }
        if (receivedMessage.senderId === currentEmployeeId) {
            var myChatContent = messageRow.find('.my-chat-content');
            myChatContent.empty(); // 기존 내용을 비움
            myChatContent.append('<p>삭제된 메세지입니다.</p>');
        } else {
            var chatContent = messageRow.find('.chat-content');
            chatContent.empty(); // 기존 내용을 비움
            chatContent.append('<p>삭제된 메세지입니다.</p>');
        }
        messageRow.find('.emoticon-box .emoticon-button').remove();
    }

    function readMessage(receivedMessage) {
        receivedMessage.unreadMessageIds.forEach(function (messageId) {
            // unread-count-box 값 가져와서 -1 했을 때 0이되면 삭제
            // unread-count-box 값 가져와서 -1 했을 때 0이 아니면 -1
            var unreadCountBox = $('.chat .row[data-message-id="' + messageId + '"] .unread-count-box');
            var unreadCount = parseInt(unreadCountBox.text());
            if (unreadCount - 1 === 0) {
                unreadCountBox.remove();
            } else {
                unreadCountBox.html(`<span class="unread-count">${unreadCount - 1}</span>`);
            }
        });
    }

    function addEnterMessage(enterMessage) {
        var chatRow = `
        <div class="row chat-one">
                <div class="col-10">
                    <div class="row">
                        <div class="col-1 d-flex justify-content-end">
                            <div class="add-chat-profile">
                                <i class="fa-solid fa-user-plus"></i>
                            </div>
                        </div>
                        <div class="col-9">
                            <div class="chat-bubble-container d-flex align-items-end">
                                <div
                                        class="d-flex align-items-center justify-content-center"
                                >
                                    <p>${enterMessage.chatContents}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        $('.chat-container').append(chatRow);
    }

    function updateEmoticon(emoticonMessage) {

        $.ajax({
            url: '/api/chatrooms/' + currentChatRoomId + '/chats/' + emoticonMessage.chatId + '/emoticon',
            method: 'GET',
            dataType: 'json',
            success: function (response) {
                console.log(response);
                var messageRow = $('.chat .row[data-message-id="' + emoticonMessage.chatId + '"]');

                if (messageRow.length === 0) {
                    console.error('메시지를 찾을 수 없습니다:', emoticonMessage.chatId);
                    return;
                }

                // 기존 이모티콘 박스 제거
                messageRow.find('.emoticon-boxes').remove();

                console.log(emoticonMessage.chatterId);

                // 새로운 이모티콘 박스 생성
                let emoticonHtml;
                if (emoticonMessage.chatterId === currentEmployeeId) {
                    emoticonHtml = createMyEmoticonBoxHtml(response);
                } else {
                    emoticonHtml = createEmoticonBoxHtml(response);
                }

                console.log(emoticonHtml);

                // 새로운 이모티콘 박스 DOM에 추가
                messageRow.find('.add-emoticon-point').append(emoticonHtml);
            },
            error: function (xhr, status, error) {
                console.error('이모티콘 추가에 실패했습니다:', error);
            }
        });

    }

    function addMessage(chatMessage) {
        var chatContainer = $('.chat-container');
        let chat = $('.chat');
        var isAtBottom = chat.scrollTop() + chat.innerHeight() >= chat[0].scrollHeight - 100;

        var chatRow = generateMessageHtml(chatMessage);
        chatContainer.append(chatRow); // Append new message at the bottom

        if (isAtBottom) {
            chat.scrollTop(chat.prop('scrollHeight'));
        }
    }

    function showEmoticonBox(event) {
        var emoticonBox = $('#emoticon-box');
        var target = $(event.currentTarget);
        currentMessageId = target.closest('.row[data-message-id]').data('message-id');

        emoticonBox.css('display', 'block');
        var offset = target.offset();
        var boxHeight = emoticonBox.outerHeight();

        if (target.hasClass('my-chat-content')) {
            emoticonBox.css({
                right: '60px',
                left: '',
                top: offset.top - boxHeight + 10 + 'px'
            });
        } else {
            emoticonBox.css({
                left: offset.left + 10 + 'px',
                right: '',
                top: offset.top - boxHeight + 10 + 'px'
            });
        }
    }

    function hideEmoticonBox() {
        timeoutId = setTimeout(function () {
            $('#emoticon-box').hide();
        }, 100);
    }

    // 동적 요소에 대한 이벤트 위임
    $('.chat').on({
        mouseenter: function (event) {
            showEmoticonBox(event);
        },
        mouseleave: function () {
            hideEmoticonBox();
        }
    }, '.chat-content, .my-chat-content');

    $('#emoticon-box').hover(
        function () {
            clearTimeout(timeoutId);
        },
        function () {
            $(this).hide();
        }
    );

    $('#emoticon-box i').on('click', function () {
        var emoticonType = $(this).data('emoticon-type');

        if (currentMessageId) {
            $.ajax({
                url: '/api/chatrooms/' + currentChatRoomId + '/chats/' + currentMessageId + '/emoticon',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({emoticonType: emoticonType}),
                success: function (response) {
                },
                error: function (xhr, status, error) {
                    console.error('이모티콘 추가에 실패했습니다:', error);
                }
            });
        } else {
            console.error('메시지 ID를 알 수 없습니다.');
        }
    });

    function getEmoticonIconClass(emoticonType) {
        var iconClasses = {
            'CHECK': 'fa-solid fa-check',
            'HEART': 'fa-solid fa-heart heart-icon',
            'THUMBS_UP': 'fa-solid fa-thumbs-up',
            'SMILE': 'fa-solid fa-face-smile',
            'SAD': 'fa-solid fa-face-sad-cry'
        };
        return iconClasses[emoticonType] || '';
    }

    function createEmoticonButton(message) {
        var emoticonTypes = ['CHECK', 'HEART', 'THUMBS_UP', 'SMILE', 'SAD'];
        var addContent = '';

        emoticonTypes.forEach(function (type) {

            var countKey = type.toLowerCase() + 'EmoticonCount';

            var clickedKey = 'isClicked' + type.charAt(0) + type.slice(1).toLowerCase() + 'Emoticon';
            if (type === 'THUMBS_UP') {
                countKey = 'thumbsUpEmoticonCount';
                clickedKey = 'isClickedThumbsUpEmoticon';
            }

            if (message[countKey] > 0) {
                var activeClass = message[clickedKey] ? 'active-button' : '';
                addContent += `
                <button class="emoticon-button ${activeClass}" data-emoticon-type="${type}">
                    <i class="${getEmoticonIconClass(type)}"></i>
                    <span>${message[countKey]}</span>
                </button>`;
            }
        });

        return addContent;
    }

    function formatDate(dateString) {
        var date = new Date(dateString);
        return date.toLocaleString('ko-KR', {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    //emp-count-box 클릭 시 ajax로 직원 목록 가져오기
    var empModal = $('#emp-modal');
    var addEmpModal = $('#add-emp-modal');
    var empModalVisible = false;
    var addEmpModalVisible = false;

    // 모달 이벤트 핸들러 중복 방지
    $('.emp-count-box').off('click').on('click', function () {
        if (empModalVisible) {
            // 모달이 보이면 숨기기
            empModal.hide();
            addEmpModal.hide();
            addEmpModalVisible = false;  // 모달 상태 업데이트
            empModalVisible = false;  // 모달 상태 업데이트
            return;
        }
        empModalVisible = true;

        // AJAX 요청 전에 기존 데이터 비우기
        $('.emp-list').empty();
        $('.count').text('사람 (0)');

        // 모달 보이기
        empModal.show();

        // 데이터 불러오기
        $.ajax({
            url: '/api/chatrooms/' + currentChatRoomId + '/employees',
            type: 'GET',
            dataType: 'json',
            success: function (data) {
                updateEmployeeList(data);
            },
            error: function (xhr, status, error) {
                console.error("데이터를 불러오는 데 실패했습니다:", error);
            }
        });
    });

    // 모달 외부 클릭 시 닫기
    $(window).on('click', function (event) {
        if (!$(event.target).closest('#emp-modal, .emp-count-box, #add-emp-modal').length && empModalVisible) {
            empModal.hide();
            empModalVisible = false;
            addEmpModal.hide();
            addEmpModalVisible = false;
        }
    });

    // $(window).on('click', function(event) {
    //     var sendFileModal = $('#send-file-modal');
    //     console.log('Clicked element:', event.target); // 클릭된 요소 로그
    //     console.log('Closest matching elements:', $(event.target).closest('#send-file-modal, .fa-file, .dropzone, .dz-default, .dz-message, .dz-clickable'));
    //
    //     // Check if the click target is outside the modal, the file icon, and any part of the Dropzone.
    //     if (!$(event.target).closest('#send-file-modal, .fa-file, .dropzone, .dz-default, .dz-message, .dz-clickable, #my-dropzone, .dz-default').length && sendFileModalVisible) {
    //         console.log('파일 전송 모달을 닫습니다.');
    //         sendFileModal.hide();
    //         sendFileModalVisible = false;
    //     }
    // });

    // 모달 닫기 버튼 클릭 시 닫기
    $('.send-cancel-button').on('click', function () {
        $('#send-file-modal').hide();
        initializeDropzone();
        sendFileModalVisible = false;
    });

    function updateEmployeeList(data) {
        console.log(data);
        var listElement = $('.emp-list');
        $.each(data, function (index, employee) {
            listElement.append(
                `<div class="row emp-one d-flex align-items-center">
                <div class="col-5">
                    <div class="profile">
                        <img src="${employee.profileUrl}" />
                        ` + addProfileStatus(employee.status) + `
                    </div>
                </div>
                <div class="col-7 pl-0">
                    <p class="emp-name">${employee.name}</p>
                </div>
            </div>`
            );
        });
        $('.count').text(`사람 (${data.length})`);
    }

    let tagify;

    $('.add-emp-box').off('click').on('click', function () {

        if (addEmpModalVisible) {
            console.log('모달이 이미 보이고 있습니다.');

            // Tagify 인스턴스 제거


            addEmpModal.hide();
            addEmpModalVisible = false;
            return;
        }

        if (tagify) {
            tagify.destroy();
            tagify = null;
        }

        // 입력 필드 초기화
        let inputElm = document.querySelector("input[name='except-ptpt-employees[]']");
        inputElm.value = '';

        // Tagify가 생성한 DOM 요소 제거 및 입력 필드 대체
        let newInputElm = inputElm.cloneNode(false); // 자식 노드 없이 클론 생성
        inputElm.parentNode.replaceChild(newInputElm, inputElm);

        // 모달을 열고 Tagify를 재초기화하기 전에 입력 필드를 다시 선택
        addEmpModal.show();
        addEmpModalVisible = true;

        let whitelist = [];

        // AJAX를 통해 직원 목록 가져오기
        $.ajax({
            url: '/api/chatrooms/' + currentChatRoomId + '/except-participants',
            method: 'GET',
            dataType: 'json',
            success: function (data) {
                addEmpModal.show();
                addEmpModalVisible = true;
                console.log('직원 데이터를 성공적으로 가져왔습니다:', data);
                whitelist = data.map(function (employee) {
                    return {
                        name: employee.name + '/' + employee.position + '/' + employee.deptName, // 태그에 표시될 내용
                        value: employee.id.toString(), // 직원 ID를 문자열로 변환하여 저장
                    };
                });

                console.log('직원 데이터를 성공적으로 가져왔습니다:', whitelist);

                // Tagify 초기화
                let inputElm = document.querySelector("input[name='except-ptpt-employees[]']");

                // initialize Tagify
                tagify = new Tagify(inputElm, {
                    enforceWhitelist: true, // 화이트리스트에서 허용된 태그만 사용
                    whitelist: whitelist, // 화이트 리스트 배열. 화이트 리스트를 등록하면 자동으로 드롭다운 메뉴가 생긴다
                    autogrow: true, // 태그 입력창이 자동으로 늘어난다

                    originalInputValueFormat: function (valuesArr) {
                        return valuesArr.map(function (item) {
                            return item.value;
                        });
                    },
                    templates: {
                        tag: function (tagData) {
                            return `
                            <tag title="${tagData.name}"
                                contenteditable='false'
                                spellcheck='false'
                                class='tagify__tag ${tagData.class ? tagData.class : ''}'
                                ${this.getAttributes(tagData)}>
                                <x title='remove tag' class='tagify__tag__removeBtn'></x>
                                <div>
                                    <span class='tagify__tag-text'>${tagData.name}</span>
                                </div>
                            </tag>`;
                        },
                        dropdownItem: function (tagData) {
                            return `
                            <div ${this.getAttributes(tagData)}
                                class='tagify__dropdown__item ${tagData.class ? tagData.class : ''}'>
                                <span>${tagData.name}</span>
                            </div>`;
                        }
                    },
                    dropdown: {
                        // 검색에 사용할 속성 지정
                        searchKeys: ['name'],
                        maxItems: 3, // 최대 표시 아이템 수 (필요에 따라 조정)
                        position: "input",
                        enabled: 0    // 0으로 설정하면 입력한 글자 수와 상관없이 항상 드롭다운을 표시
                    }
                });

                // tagify 전용 이벤트 리스터
                tagify
                    .on("add", onAddTag) // 태그가 추가되면
                    .on("remove", onRemoveTag) // 태그가 제거되면
                    .on("input", onInput) // 태그가 입력되고 있을 경우
                    .on("invalid", onInvalidTag) // 허용되지 않는 태그일 경우
                    .on("click", onTagClick) // 해시 태그 블럭을 클릭할 경우
                    .on("focus", onTagifyFocusBlur) // 포커스 될 경우
                    .on("blur", onTagifyFocusBlur) // 반대로 포커스를 잃을 경우
                    .on("edit:start", onTagEdit) // 입력된 태그 수정을 할 경우
                    .on("dropdown:hide dropdown:show", (e) => console.log(e.type)) // 드롭다운 메뉴가 사라질경우
                    .on("dropdown:select", onDropdownSelect); // 드롭다운 메뉴에서 아이템을 선택할 경우

                // 이벤트 리스너 콜백 메소드 정의
                function onAddTag(e) {
                    console.log("onAddTag: ", e.detail);
                    console.log("original input value: ", inputElm.value);
                }

                function onRemoveTag(e) {
                    console.log(
                        "onRemoveTag:",
                        e.detail,
                        "tagify instance value:",
                        tagify.value
                    );
                }

                function onTagEdit(e) {
                    console.log("onTagEdit: ", e.detail);
                }

                function onInvalidTag(e) {
                    console.log("onInvalidTag: ", e.detail);
                }

                function onTagClick(e) {
                    console.log(e.detail);
                    console.log("onTagClick: ", e.detail);
                }

                function onTagifyFocusBlur(e) {
                    console.log(e.type, "event fired");
                }

                function onDropdownSelect(e) {
                    console.log("onDropdownSelect: ", e.detail);
                }

                function onInput(e) {
                    console.log("onInput: ", e.detail);

                    tagify.loading(true); // 태그 입력하는데 우측에 loader 애니메이션 추가
                    tagify.loading(false); // loader 애니메이션 제거

                    tagify.dropdown.show(e.detail.value); // 드롭다운 메뉴 보여주기
                    tagify.dropdown.hide(); // 드롭다운 제거
                }
            },
            error: function (xhr, status, error) {
                console.error('직원 데이터를 가져오는 데 실패했습니다:', error);
            }
        });
    });

    $('.create-button').on('click', function () {
        // input에서 값 가져오기
        var employees = $('input[name="except-ptpt-employees[]"]').val();
        // 쉼표로 분리하고 숫자로 변환
        var employeeIds = employees.split(',').map(Number);
        var dataToSend = {
            employees: employeeIds // 서버가 기대하는 객체 형식
        };
        // Ajax 요청 보내기
        $.ajax({
            url: '/api/chatrooms/' + currentChatRoomId + '/participants',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(dataToSend), // JSON 형태로 변환
            success: function (data) {
                console.log('채팅방 참여자 추가에 성공했습니다:', data);
                empModal.hide();
                empModalVisible = false;
                addEmpModal.hide();
                addEmpModalVisible = false;
            },
            error: function (xhr, status, error) {
                console.error('채팅방 참여자 추가에 실패했습니다:', error);
            }
        });
    });

    $('.cancel-button').on('click', function () {
        addEmpModal.hide();
        addEmpModalVisible = false
    });

    function loadChatMessages() {
        if (loading || !hasMoreData) return;
        loading = true;

        showLoadingIndicator();

        $.ajax({
            url: '/api/chatrooms/' + currentChatRoomId,
            method: 'GET',
            dataType: 'json',
            data: {offset: offset, limit: limit},
            success: function (data) {
                if (data.chatInfoList.length < limit) {
                    hasMoreData = false; // 모든 데이터 로드 완료
                }
                offset += data.chatInfoList.length; // 오프셋 업데이트
                addChatContents(data.chatInfoList);
                loading = false;

                hideLoadingIndicator();
            },
            error: function (xhr, status, error) {
                console.error('추가 채팅 데이터 로드 실패:', error);
                loading = false;
            }
        });
    }

    // 스크롤 이벤트 핸들러
    $('.chat').on('scroll', function () {
        var $this = $(this);
        var scrollTop = $this.scrollTop();

        // If scrollTop is less than or equal to a threshold (e.g., 100px), load more messages
        if (scrollTop <= 100 && !loading && hasMoreData) {
            loadChatMessages();
        }
    });

    //이모티콘 버튼 클릭 이벤트
    $('.chat').on('click', '.emoticon-button', function () {
        currentMessageId = $(this).closest('.row[data-message-id]').data('message-id');

        console.log('이모티콘 버튼 클릭 이벤트 발생');
        var emoticonType = $(this).data('emoticon-type');

        // active-button 클래스 추가
        if ($(this).hasClass('active-button')) {
            $(this).removeClass('active-button');
        } else {
            $(this).addClass('active-button');
        }

        if (stompClient && stompClient.connected) {
            console.log(emoticonType);
            console.log()
            $.ajax({
                url: '/api/chatrooms/' + currentChatRoomId + '/chats/' + currentMessageId + '/emoticon',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({emoticonType: emoticonType}),
                success: function (response) {
                },
                error: function (xhr, status, error) {
                    console.error('이모티콘 추가에 실패했습니다:', error);
                }
            });
        } else {
            console.error('WebSocket이 연결되어 있지 않습니다.');
        }
    });

    var sendFileModalVisible = false;

    var tagify2;

    // <i class="fa-regular fa-file"></i> 버튼 클릭 시 파일 전송 모달 띄우기
    $('.fa-file').on('click', function () {
        if (sendFileModalVisible) {
            $('#send-file-modal').hide();
            sendFileModalVisible = false;
            return;
        }

        if (!currentChatRoomId) {
            alert('Please select a chat room first.');
            return;
        }

        $('#send-file-modal').show();
        sendFileModalVisible = true;




        initFileTagify();
    });

    function initializeDropzone() {
        let dropzoneElement = document.querySelector("div.dropzone");
        if (!dropzoneElement) {
            console.error('Dropzone element not found!');
            return;
        }

        // Destroy existing instance if any
        if (dropzoneElement.dropzone) {
            dropzoneElement.dropzone.destroy();
        }

        Dropzone.autoDiscover = false;

        // Initialize Dropzone
        myDropzone = new Dropzone(dropzoneElement, {
            url: "/api/chatrooms/" + currentChatRoomId + "/attached-file/send",
            method: 'post',
            autoProcessQueue: false,
            parallelUploads: 100,
            paramName: 'multipartFiles',
            uploadMultiple: true,
            init: function () {
                const modal = document.getElementById("send-file-modal");

                let sendFileButton = document.querySelector('.send-file-create-button');
                sendFileButton.addEventListener('click', function () {
                    console.log('Uploading...');
                    if (myDropzone.getRejectedFiles().length > 0) {
                        let files = myDropzone.getRejectedFiles();
                        console.log('Rejected files:', files);
                        return;
                    }
                    myDropzone.processQueue();
                });

                this.on('sendingmultiple', function (files, xhr, formData) {
                    var tags = tagify2.value.map(function(item) { return item.value; });
                    for (var i = 0; i < tags.length; i++) {
                        formData.append('tags', tags[i]);
                    }
                });

                this.on('successmultiple', function (files, responseText) {
                    console.log('Upload successful');
                    modal.style.display = "none";
                    sendFileModalVisible = false;
                    myDropzone.removeAllFiles(); // Optional: Clear files
                });

                this.on('errormultiple', function (files, responseText) {
                    console.error('Upload failed', responseText);
                    alert('File upload failed.');
                });
            },
        });
    }
    let fileTagify;

    $('.file-button').on('click', function () {
        $('.chat-area').hide();
        $('.image-area').hide();
        $('.file-area').show();
        // file-button 상위 div에 active 추가
        $('.file-button').parent().addClass('active');
        $('.chat-button').parent().removeClass('active');
        $('.image-button').parent().removeClass('active');

        if (fileTagify) {
            fileTagify.destroy();
            // 태그 input 초기화
            document.querySelector('input[name=tags]').value = '';
        }


        let inputElm = document.querySelector('input[name=tags]');

        // 화이트 리스트 : 해당 문자만 태그로 추가 가능
        let whitelist = ["서류","계획서","제안서","발표자료","ppt"];

        // initialize Tagify
        fileTagify = new Tagify(inputElm, {
            enforceWhitelist: false, // 화이트리스트에서 허용된 태그만 사용
            whitelist: whitelist // 화이트 리스트 배열. 화이트 리스트를 등록하면 자동으로 드롭다운 메뉴가 생긴다
        })

        fileTagify.on('add', onAddTag) // 태그가 추가되면
            .on('remove', onRemoveTag) // 태그가 제거되면
            .on('input', onInput) // 태그가 입력되고 있을 경우
            .on('invalid', onInvalidTag) // 허용되지 않는 태그일 경우
            .on('click', onTagClick) // 해시 태그 블럭을 클릭할 경우
            .on('focus', onTagifyFocusBlur) // 포커스 될 경우
            .on('blur', onTagifyFocusBlur) // 반대로 포커스를 잃을 경우

            .on('edit:start', onTagEdit) // 입력된 태그 수정을 할 경우

            .on('dropdown:hide dropdown:show', e => console.log(e.type)) // 드롭다운 메뉴가 사라질경우
            .on('dropdown:select', onDropdownSelect) // 드롭다운 메뉴에서 아이템을 선택할 경우

        function onAddTag(e){
            console.log("onAddTag: ", e.detail);
            console.log("original input value: ", inputElm.value)
            tableBody.innerHTML = '';
            tableBody.dataset.loading = 'false';
            fileMoreData = true;
            loadMoreData();
        }

        function onRemoveTag(e){
            console.log("onRemoveTag:", e.detail, "tagify instance value:", inputElm.value);
            tableBody.innerHTML = '';
            tableBody.dataset.loading = 'false';
            fileMoreData = true;
            loadMoreData();
        }

        function onTagEdit(e){
            console.log("onTagEdit: ", e.detail);
        }

        // invalid tag added callback
        function onInvalidTag(e){
            console.log("onInvalidTag: ", e.detail);
        }

        // invalid tag added callback
        function onTagClick(e){
            console.log(e.detail);
            console.log("onTagClick: ", e.detail);
        }

        function onTagifyFocusBlur(e){
            console.log(e.type, "event fired")
        }

        function onDropdownSelect(e){
            console.log("onDropdownSelect: ", e.detail)
        }

        function onInput(e){
            console.log("onInput: ", e.detail);

            tagify2.loading(true) // 태그 입력하는데 우측에 loader 애니메이션 추가
            tagify2.loading(false) // loader 애니메이션 제거

            tagify2.dropdown.show(e.detail.value); // 드롭다운 메뉴 보여주기
            tagify2.dropdown.hide(); // // 드롭다운 제거
        }

        // file table 초기화
        let tableBody = document.querySelector('.file-table tbody');
        tableBody.innerHTML = '';
        tableBody.dataset.loading = 'false';
        fileMoreData = true;
        loadMoreData();
    });

    let tableBody = document.querySelector('.file-table tbody');
    document.querySelector('.file-table tbody').addEventListener('scroll', function() {
        if (tableBody.scrollTop + tableBody.clientHeight >= tableBody.scrollHeight) {
            // 스크롤이 바닥에 도달했을 때 실행할 코드
            loadMoreData();
        }
    });

    let fileMoreData;

    function loadMoreData() {
        if (tableBody.dataset.loading === 'true') return;
        console.log("파일 로드 실행");

        tableBody.dataset.loading = 'true';
        let searchTags = fileTagify.value.map(tag => tag.value);
        let fileOffset = tableBody.children.length;
        let searchType = $('.file-area .dropdown-toggle').text().trim().replace(/\s+/g, ' ');

        $.ajax({
            url: '/api/chatrooms/' + currentChatRoomId + '/attached-files',
            method: 'GET',
            dataType: 'json',
            data: {offset: fileOffset, limit: 30, tags: searchTags, searchType: searchType},
            success: function (data) {
                if (offset === 0) {
                    // 처음 로드이거나 필터가 변경되어 데이터를 초기화한 경우
                    $('.file-table tbody').empty();
                }
                if (data.length > 0) {
                    appendDataToTable(data);
                    offset += data.length;
                } else {
                    isEnd = true; // 더 이상 데이터 없음
                }
            },
            error: function (xhr, status, error) {
                console.error('채팅방 파일 데이터를 가져오는 데 실패했습니다:', error);
            }
        });
    }

    function addFileContents(data) {
        data.forEach(function (file) {
            // 태그 HTML 생성
            let tagsHTML = '';
            if (file.tags && file.tags.length > 0) {
                file.tags.forEach(function(tag) {
                    tagsHTML += `<span class="tag">${tag}</span> `;
                });
            }

            // 테이블 행 생성
            let tr = document.createElement('tr');
            tr.setAttribute('data-message-id', file.chatId); // 메시지 ID 저장
            tr.setAttribute('data-file-id', file.fileId); // 메시지 ID 저장
            tr.innerHTML = `
            <td>${file.fileName}</td>
            <td>${file.writeDt}</td>
            <td>${file.sender}</td>
            <td>${tagsHTML}</td>
            <td>
                <i class="fas fa-download"></i>
            </td>
        `;
            tableBody.appendChild(tr);
        });
        tableBody.dataset.loading = 'false';
    }

    $(document).on('click', '.fa-download', function() {
        let fileId = $(this).data('file-id');
        // 파일 다운로드를 위한 URL 설정
        $.ajax({
            url: `/api/chatrooms/image/${fileId}/download`,
            method: 'GET',
            xhrFields: {
                responseType: 'blob' // 바이너리 데이터 수신을 위해 필요합니다.
            },
            success: function(response, textStatus, xhr) {
                // 파일명 추출 (Content-Disposition 헤더에서 추출)
                var filename = "";
                var disposition = xhr.getResponseHeader('Content-Disposition');
                if (disposition && disposition.indexOf('attachment') !== -1) {
                    var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    var matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) {
                        filename = decodeURIComponent(matches[1].replace(/['"]/g, ''));
                    }
                } else {
                    // 파일명이 없을 경우 기본값 설정
                    filename = "downloaded_file";
                }

                // Blob 객체 생성 후 다운로드
                var blob = new Blob([response], { type: 'application/octet-stream' });
                var link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            },
            error: function(xhr, status, error) {
                console.error('파일 다운로드에 실패했습니다:', error);
            }
        });
    });

    // 파일 다운로드 버튼 이벤트 리스너
    $('.chat').on('click', '.file-box .fa-download', function() {
        // 이벤트가 발생한 메시지 ID를 찾습니다.
        var messageId = $(this).closest('.row[data-message-id]').data('message-id');
        var chatRoomId = currentChatRoomId; // 현재 채팅방 ID

        // 파일 다운로드 요청
        $.ajax({
            url: `/api/chatrooms/chats/${messageId}/attached-file/download`,
            method: 'GET',
            xhrFields: {
                responseType: 'blob' // Important
            },
            success: function(response, textStatus, xhr) {
                // 파일명 추출 (Content-Disposition 헤더에서 추출)
                var filename = "";
                var disposition = xhr.getResponseHeader('Content-Disposition');
                if (disposition && disposition.indexOf('attachment') !== -1) {
                    var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    var matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) {
                        filename = decodeURIComponent(matches[1].replace(/['"]/g, ''));
                    }
                } else {
                    // 파일명이 없을 경우 기본값 설정
                    filename = "downloaded_file";
                }

                // Blob 객체 생성 후 다운로드
                var blob = new Blob([response], { type: 'application/octet-stream' });
                var link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            },
            error: function(xhr, status, error) {
                console.error('파일 다운로드에 실패했습니다:', error);
            }
        });
    });

    $('.fa-pen-to-square').on('click', function () {
        $('.contents').hide();
        $('.save-contents').show();
    });

    $('.save-contents .cancel-button').on('click', function () {
       $('.contents').hide();
       $('.default-contents').show();
    });

    $('.chat-rooms-list').on('click', '.chat-room-item', function() {
        $('.contents').hide();
        $('.chat-contents').show();
        $('.chat-area').show();
        $('.file-area').hide();
        $('.image-area').hide();
        $('.chat-button').parent().addClass('active');
        $('.file-button').parent().removeClass('active');
        $('.image-button').parent().removeClass('active');

        $('.images .row').empty();
    });

    $('.chat-button').on('click', function () {
        $('.contents').hide();
        $('.chat-contents').show();
        $('.chat-area').show();
        $('.file-area').hide();
        $('.image-area').hide();
        // chat-button 상위 div에 active 추가
        $('.chat-button').parent().addClass('active');
        $('.file-button').parent().removeClass('active');
        $('.image-button').parent().removeClass('active');
    })

    $('.favor-box').on('click', function () {
        if ($(this).hasClass('inactive-box')) {
            $(this).removeClass('inactive-box');
            $('.selection-box').addClass('inactive-box');
        }
        handleFavorChatRoomListUpdate();
    });

    $('.selection-box').on('click', function () {
        if ($(this).hasClass('inactive-box')) {
            $(this).removeClass('inactive-box');
            $('.favor-box').addClass('inactive-box');
        }
        handleChatRoomListUpdate();
    });

    function handleFavorChatRoomListUpdate() {
        $.ajax({
            url: '/api/chatrooms/favorite',
            method: 'GET',
            dataType: 'json',
            success: function (data) {
                console.log(data);
                updateChatRoomList(data);
                updateDateFormat();
            },
            error: function (xhr, status, error) {
                console.error('채팅방 정보를 가져오는 데 실패했습니다:', error);
            }
        });
    }

    let imageTagify;

    $('.image-button').on('click', function () {
        $('.chat-area').hide()
        $('.file-area').hide();
        $('.image-area').show();
        // file-button 상위 div에 active 추가
        $('.file-button').parent().removeClass('active');
        $('.chat-button').parent().removeClass('active');
        $('.image-button').parent().addClass('active');

        if (imageTagify) {
            imageTagify.destroy();
            // 태그 input 초기화
            document.querySelector('input[name=imageTags]').value = '';
        }


        let inputElm = document.querySelector('input[name=imageTags]');

        // 화이트 리스트 : 해당 문자만 태그로 추가 가능
        let whitelist = ["서류","계획서","제안서","발표자료","ppt"];

        // initialize Tagify
        imageTagify = new Tagify(inputElm, {
            enforceWhitelist: false, // 화이트리스트에서 허용된 태그만 사용
            whitelist: whitelist // 화이트 리스트 배열. 화이트 리스트를 등록하면 자동으로 드롭다운 메뉴가 생긴다
        })

        imageTagify.on('add', onAddTag) // 태그가 추가되면
            .on('remove', onRemoveTag) // 태그가 제거되면
            .on('input', onInput) // 태그가 입력되고 있을 경우
            .on('invalid', onInvalidTag) // 허용되지 않는 태그일 경우
            .on('click', onTagClick) // 해시 태그 블럭을 클릭할 경우
            .on('focus', onTagifyFocusBlur) // 포커스 될 경우
            .on('blur', onTagifyFocusBlur) // 반대로 포커스를 잃을 경우

            .on('edit:start', onTagEdit) // 입력된 태그 수정을 할 경우

            .on('dropdown:hide dropdown:show', e => console.log(e.type)) // 드롭다운 메뉴가 사라질경우
            .on('dropdown:select', onDropdownSelect) // 드롭다운 메뉴에서 아이템을 선택할 경우

        function onAddTag(e) {
            console.log("onAddTag: ", e.detail);
            console.log("original input value: ", imageTagify.DOM.originalInput.value);
            loadImageData();
        }

        function onRemoveTag(e) {
            console.log("onRemoveTag:", e.detail, "tagify instance value:", imageTagify.DOM.originalInput.value);
            loadImageData();
        }

        function onTagEdit(e) {
            console.log("onTagEdit: ", e.detail);
        }

        function onInvalidTag(e) {
            console.log("onInvalidTag: ", e.detail);
        }

        function onTagClick(e) {
            console.log(e.detail);
            console.log("onTagClick: ", e.detail);
        }

        function onTagifyFocusBlur(e) {
            console.log(e.type, "event fired");
        }

        function onDropdownSelect(e) {
            console.log("onDropdownSelect: ", e.detail);
        }

        function onInput(e) {
            console.log("onInput: ", e.detail);

            imageTagify.loading(true); // 태그 입력하는데 우측에 loader 애니메이션 추가
            imageTagify.loading(false); // loader 애니메이션 제거

            imageTagify.dropdown.show(e.detail.value); // 드롭다운 메뉴 보여주기
            imageTagify.dropdown.hide(); // 드롭다운 제거
        }

        loadImageData();
    });

    $('.dropdown-menu a').click(function() {
        // 클릭된 아이템의 텍스트를 가져옴
        var selectedText = $(this).text();
        // 버튼의 텍스트를 클릭된 아이템의 텍스트로 변경
        $(this).closest('.btn-group').find('.dropdown-toggle').text(selectedText);
    });

    function loadImageData() {
        let searchTags = imageTagify.value.map(tag => tag.value);
        //button에 따라 searchType을 다르게 설정
        let searchType = $('.image-area .dropdown-toggle').text().trim().replace(/\s+/g, ' ');
        $.ajax({
            url: '/api/chatrooms/' + currentChatRoomId + '/image',
            method: 'GET',
            dataType: 'json',
            data: {tags: searchTags, searchType: searchType},
            success: function (data) {
                console.log(data);
                addImageContents(data);
            },
            error: function (xhr, status, error) {
                console.error('채팅방 파일 데이터를 가져오는 데 실패했습니다:', error);
            }
        });
    }

    function addImageContents(data) {
        $('.images .row').empty();

        data.forEach(function (image) {
            // 이미지 생성
            let appendImageContents = `
                    <div class="col-3">
                        <div class="image-box">
                            <img src="${image.fileUrl}" data-file-id="${image.fileId}" data-chat-id="${image.chatId}">
                        </div>
                    </div>
            `
            // 이미지 추가
            $('.images .row').append(appendImageContents);

        });
    }

    function showLoadingIndicator() {
        $('.loading-indicator').show();
    }

    function hideLoadingIndicator() {
        $('.loading-indicator').hide();
    }

    $('.chat-input').on('paste', function (event) {
        var items = (event.originalEvent.clipboardData || event.clipboardData).items;
        var blob = null;

        for (var i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                blob = items[i].getAsFile();
                break;
            }
        }

        if (blob !== null) {
            event.preventDefault(); // 기본 붙여넣기 동작 방지
            handleImagePaste(blob);
        }
    });

    function handleImagePaste(blob) {
        // 파일 이름 설정 (예: clipboard_image.png)
        blob.name = "clipboard_image.png";

        // Dropzone에 파일 추가
        console.log(myDropzone);
        myDropzone.addFile(blob);

        // 파일 전송 모달을 표시하여 사용자가 확인할 수 있도록 합니다.
        if (!sendFileModalVisible) {
            var modal = document.getElementById("send-file-modal");
            var fileIcon = document.querySelector(".fa-file");

            var rect = fileIcon.getBoundingClientRect();
            var modalWidth = modal.offsetWidth;
            var modalHeight = modal.offsetHeight;

            var leftPosition = window.scrollX + rect.left - modalWidth - 400;
            var topPosition = window.scrollY + rect.top - modalHeight - 360; // 모달 높이와 추가적인 간격을 빼서 위로 이동

            modal.style.top = topPosition + "px";
            modal.style.left = leftPosition + "px";
            modal.style.display = "block";
            $('#send-file-modal').show();
            sendFileModalVisible = true;
        }
    }

    function initFileTagify() {
        if (tagify2) {
            tagify2.destroy();
            // 태그 input 초기화
            document.querySelector('input[name=tag]').value = '';
        }


        let inputElm = document.querySelector('input[name=tag]');

        // 화이트 리스트 : 해당 문자만 태그로 추가 가능
        let whitelist = ["서류", "계획서", "제안서", "발표자료", "ppt"];

        // initialize Tagify
        tagify2 = new Tagify(inputElm, {
            enforceWhitelist: false, // 화이트리스트에서 허용된 태그만 사용
            whitelist: whitelist // 화이트 리스트 배열. 화이트 리스트를 등록하면 자동으로 드롭다운 메뉴가 생긴다
        })

        // tagify 전용 이벤트 리스터. 참조 : https://github.com/yairEO/tagify#events
        tagify2.on('add', onAddTag) // 태그가 추가되면
            .on('remove', onRemoveTag) // 태그가 제거되면
            .on('input', onInput) // 태그가 입력되고 있을 경우
            .on('invalid', onInvalidTag) // 허용되지 않는 태그일 경우
            .on('click', onTagClick) // 해시 태그 블럭을 클릭할 경우
            .on('focus', onTagifyFocusBlur) // 포커스 될 경우
            .on('blur', onTagifyFocusBlur) // 반대로 포커스를 잃을 경우

            .on('edit:start', onTagEdit) // 입력된 태그 수정을 할 경우

            .on('dropdown:hide dropdown:show', e => console.log(e.type)) // 드롭다운 메뉴가 사라질경우
            .on('dropdown:select', onDropdownSelect) // 드롭다운 메뉴에서 아이템을 선택할 경우


        // tagify 전용 이벤트 리스너 제거 할떄
        tagify2.off('add', onAddTag);


        // 이벤트 리스너 콜백 메소드
        function onAddTag(e) {
            console.log("onAddTag: ", e.detail);
            console.log("original input value: ", inputElm.value)
        }

        // tag remvoed callback
        function onRemoveTag(e) {
            console.log("onRemoveTag:", e.detail, "tagify instance value:", tagify2.value)
        }

        function onTagEdit(e) {
            console.log("onTagEdit: ", e.detail);
        }

        // invalid tag added callback
        function onInvalidTag(e) {
            console.log("onInvalidTag: ", e.detail);
        }

        // invalid tag added callback
        function onTagClick(e) {
            console.log(e.detail);
            console.log("onTagClick: ", e.detail);
        }

        function onTagifyFocusBlur(e) {
            console.log(e.type, "event fired")
        }

        function onDropdownSelect(e) {
            console.log("onDropdownSelect: ", e.detail)
        }

        function onInput(e) {
            console.log("onInput: ", e.detail);

            tagify2.loading(true) // 태그 입력하는데 우측에 loader 애니메이션 추가
            tagify2.loading(false) // loader 애니메이션 제거

            tagify2.dropdown.show(e.detail.value); // 드롭다운 메뉴 보여주기
            tagify2.dropdown.hide(); // // 드롭다운 제거
        }

        // Ensure the modal content is loaded before initializing
        setTimeout(function () {
            initializeDropzone();
        }, 0); // Using setTimeout to defer execution
    }



    $(document).on('mouseenter', '.preview-trigger', function() {
        let fileId = $(this).closest('tr').find('.fa-download').data('file-id');

        let previewContainer = $(this).closest('th').find('.file-preview');
        let self = $(this); // Reference to the hovered element

        // Show loading indicator
        previewContainer.html('<p>Loading preview...</p>').show();

        // Fetch the file preview
        $.ajax({
            url: `/api/attached-files/${fileId}/preview`,
            method: 'GET',
            xhrFields: {
                responseType: 'blob'
            },
            success: function(blob, status, xhr) {
                let contentType = xhr.getResponseHeader('Content-Type');

                let contentHtml = '';
                if (contentType.startsWith('image/')) {
                    let url = URL.createObjectURL(blob);
                    contentHtml = `<img src="${url}" alt="Image Preview" style="max-width: 400px; max-height: 400px;" />`;
                } else if (contentType === 'application/pdf') {
                    let url = URL.createObjectURL(blob);
                    contentHtml = `<embed src="${url}" type="application/pdf" width="400px" height="400px" />`;
                } else {
                    contentHtml = '<p>No preview available for this file type.</p>';
                }

                // Set the content
                previewContainer.html(contentHtml);

                // Wait for the content to load
                previewContainer.find('img, embed').on('load', function() {
                    setPosition();
                });

                // For non-image/pdf content or if load event doesn't fire
                setTimeout(setPosition, 100);

                function setPosition() {
                    // Get the actual dimensions of the preview container
                    let previewWidth = previewContainer.outerWidth();
                    let previewHeight = previewContainer.outerHeight();

                    // Calculate positions
                    let offset = self.offset();
                    let leftPosition = offset.left + self.outerWidth();
                    let topPosition = offset.top - $(window).scrollTop();

                    // Adjust if the preview goes beyond the viewport width
                    let viewportWidth = $(window).width();
                    if (leftPosition + previewWidth > viewportWidth) {
                        leftPosition = offset.left - previewWidth;
                    }

                    // Adjust if the preview goes beyond the viewport height
                    let viewportHeight = $(window).height();
                    if (topPosition + previewHeight > viewportHeight) {
                        topPosition = viewportHeight - previewHeight;
                        if (topPosition < 0) {
                            topPosition = 0;
                        }
                    }

                    // Set the position
                    previewContainer.css({
                        'top': topPosition+40 + 'px',
                        'left': leftPosition - 330 + 'px',
                        'position': 'fixed'
                    });
                }
            },
            error: function(xhr, status, error) {
                previewContainer.html('<p>Failed to load preview.</p>');
            }
        });
    });

    $(document).on('mouseleave', '.preview-trigger, .file-preview', function() {
        let previewContainer = $(this).closest('th').find('.file-preview');
        previewContainer.hide().empty();
    });

    function appendDataToTable(data) {
        let tbody = $('.file-table tbody');
        $.each(data, function(index, item) {
            let tags = '';
            if (item.tags && item.tags.length > 0) {
                $.each(item.tags, function(i, tag) {
                    tags += '<span class="tag">' + tag + '</span>';
                });
            }
            let row = `
                <tr>
                    <th style="width: 35%; margin-left: 10px;">
                    <div class="row align-items-center preview-trigger" style="height: 30px;">
                        <p class="file-name">
                            <i class="${addExtensionIcon(item)}"></i>
                            ${item.fileName}
                        </p>
                        </div>
                        <div class="file-preview" style="display: none; position: absolute; z-index: 1000;">
                          <!-- The preview content will be injected here -->
                        </div>
                    </th>
                    <td style="width: 15%;">
                        <div class="row align-items-center">
                            <img src="${item.senderProfileUrl}" />
                            &nbsp;${item.senderName}
                        </div>
                    </td>
                    <td style="width: 10%;">
                    <div class="row align-items-center" style="height: 30px;">
                    ${item.writeDt}
                    </div>
                    </td>
                    <td style="width: 30%;">
                    <div class="row align-items-center" style="height: 30px;">
                        ${tags}
                        </div>
                    </td>
                    <td style="width: 10%;">
                    <div class="row align-items-center" style="height: 30px; margin-left: 10px;">
                    <i class="fa-solid fa-download" data-file-id="${item.fileId}"></i>
                    </div>
                    </td>
                </tr>
            `;
            tbody.append(row);
        });
    }

    function addExtensionIcon(item) {
        let iconClass = 'fa-solid fa-file'; // 기본 아이콘
        if (item.fileExtension) {
            let ext = item.fileExtension.toLowerCase();
            switch (ext) {
                case 'pdf':
                    iconClass = 'fa-solid fa-file-pdf';
                    break;
                case 'png':
                case 'jpg':
                case 'jpeg':
                case 'gif':
                    iconClass = 'fa-solid fa-file-image';
                    break;
                case 'csv':
                    iconClass = 'fa-solid fa-file-csv';
                    break;
                case 'doc':
                case 'docx':
                    iconClass = 'fa-solid fa-file-word';
                    break;
                case 'xls':
                case 'xlsx':
                    iconClass = 'fa-solid fa-file-excel';
                    break;
                case 'ppt':
                case 'pptx':
                    iconClass = 'fa-solid fa-file-powerpoint';
                    break;
                case 'zip':
                case 'rar':
                case '7z':
                    iconClass = 'fa-solid fa-file-zipper';
                    break;
                case 'mp4':
                case 'avi':
                case 'mkv':
                    iconClass = 'fa-solid fa-file-video';
                    break;
                default:
                    iconClass = 'fa-solid fa-file';
            }
        }
        return iconClass
    }

});

document.addEventListener("DOMContentLoaded", function() {
    updateDateFormat();
});

function updateDateFormat() {
    const chatDates = document.querySelectorAll(".last-message-at p");
    const today = new Date().toISOString().slice(0, 10);

    chatDates.forEach(function (dateElement) {
        const fullDate = new Date(dateElement.textContent.trim());
        if (fullDate.toISOString().slice(0, 10) === today) {
            dateElement.textContent = fullDate.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        } else {
            dateElement.textContent = fullDate.toLocaleDateString('ko-KR', {
                month: '2-digit',
                day: '2-digit'
            }).replace(/\.\s/g, '-').slice(0, -1);
        }
    });
}

