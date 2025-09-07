let questions = []; // 사용자 질문 저장 배열
let fullConversation = []; // 전체 대화 저장 배열 (user + gpt)
let pendingQuestion = ""; // 사용자의 입력 임시 저장

let conversationBuffer = ""; // GPT 응답 버퍼
let conversationTimer = null; // debounce 타이머

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "resetData") {
    // 전역 변수 초기화
    questions = [];
    fullConversation = [];
    conversationBuffer = "";
    pendingQuestion = "";
    console.log("Global conversation data reset.");
  }
});

// 해시태그 추출 함수 (사용자 메시지용)
function extractTags(text) {
  const regex = /(?:^|\s)#(\w+)/g;
  let matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

// 사용자 메시지 저장 (질문)
function saveUserMessage(messageText) {
  if (!messageText) return;
  const timestamp = new Date().toLocaleTimeString();
  const tags = extractTags(messageText);

  const messageObj = {
    type: "user",
    text: messageText,
    time: timestamp,
    tags: tags
  };

  questions.push(messageObj);
  fullConversation.push(messageObj);
  pendingQuestion = messageObj; 

  chrome.storage.local.set({
    chatgptQuestions: questions,
    chatgptFullConversation: fullConversation
  }, () => {
    console.log('✅ 저장된 사용자 메시지:', messageText, '태그:', tags);
  });
}

// GPT 메시지 저장
function saveGPTMessage(messageText) {
  if (!messageText) return;
  const timestamp = new Date().toLocaleTimeString();

  const messageObj = {
    type: "gpt",
    text: messageText,
    time: timestamp
  };

  fullConversation.push(messageObj);

  chrome.storage.local.set({
    chatgptFullConversation: fullConversation
  }, () => {
    console.log('✅ 저장된 GPT 메시지:', messageText);
  });
}

// 버퍼에 누적된 GPT 메시지를 저장 (debounce 완료 시 호출)
function processConversationBuffer() {
  conversationBuffer = typeof conversationBuffer === 'string' ? conversationBuffer : '';
  // 모든 공백 문자(줄바꿈, 탭, 스페이스)들을 하나의 공백으로 치환
  const bufferedText = conversationBuffer.trim().replace(/\s+/g, " ");
  if (bufferedText) {
    saveGPTMessage(bufferedText);
  }
  conversationBuffer = "";
}

// 사용자 입력창에서 키 입력 감지 (Enter 키)
// 사용자 메시지를 전송 직전에 pendingQuestion에 저장
function attachInputCaptureListener(inputBox) {
  inputBox.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      pendingQuestion = (inputBox.innerText || "").trim();
    }
  }, { capture: true });
}

// 입력창의 내용 변경 감시 (비어 있으면 메시지 저장)
function observeInputBoxChanges(inputBox) {
  const observer = new MutationObserver(() => {
    const currentText = (inputBox.innerText || "").trim();
    if (currentText === "" && pendingQuestion) {
      saveUserMessage(pendingQuestion);
      pendingQuestion = "";
    }
  });
  observer.observe(inputBox, { childList: true, subtree: true, characterData: true });
}

// 폼 제출 이벤트 감지 (보조용)
function attachFormListener(form, inputBox) {
  form.addEventListener('submit', () => {
    setTimeout(() => {
      let text = (inputBox.innerText || "").trim();
      if (!text && pendingQuestion) {
        text = pendingQuestion;
      }
      if (text) {
        saveUserMessage(text);
        pendingQuestion = "";
      }
    }, 0);
  }, { capture: true });
}

// GPT 대화 감지 및 버퍼링 저장
  function attachConversationObserver() {
    const conversationContainer = document.querySelector('main');
    if (!conversationContainer) {
      console.log('❌ 대화 컨테이너를 찾지 못했습니다. 다시 시도합니다...');
      setTimeout(attachConversationObserver, 1000);
      return;
    }
  
    const observer = new MutationObserver((mutationsList) => {
      mutationsList.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 안전하게 innerText 읽기, 없으면 빈 문자열 처리
            const text = (node.innerText || "").trim();
            // 무의미하게 4o가 반복되는 경우가 있어, 4o 필터링
            if (text === "4o") {
              return;
            }
            if (text !== "") {
              conversationBuffer += text + " ";
            }
          }
        });
      });
      if (conversationTimer) clearTimeout(conversationTimer);
      conversationTimer = setTimeout(processConversationBuffer, 700);
    });
  
    observer.observe(conversationContainer, { childList: true, subtree: true });
    console.log('✅ Conversation observer attached.');
  }
  

// 입력창 및 폼 리스너
function attachListeners() {
  const inputBox = document.querySelector('#prompt-textarea');
  const composerForm = document.querySelector('form[data-type="unified-composer"]');

  if (!inputBox) {
    console.log('❌ Input box not found. Retrying...');
    setTimeout(attachListeners, 1000);
    return;
  }

  if (!inputBox.getAttribute('data-listener-attached')) {
    attachInputCaptureListener(inputBox);
    observeInputBoxChanges(inputBox);
    inputBox.setAttribute('data-listener-attached', 'true');
  }

  if (composerForm && !composerForm.getAttribute('data-listener-attached')) {
    attachFormListener(composerForm, inputBox);
    composerForm.setAttribute('data-listener-attached', 'true');
  }

  console.log('✅ Listeners attached to input and form.');
}

// DOM 변화 감지 및 리스너
function observeDOM() {
  const observer = new MutationObserver(() => {
    attachListeners();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.chatgptQuestions && changes.chatgptQuestions.newValue === undefined) {
      questions = [];
      console.log("Global 'questions' cleared via storage.onChanged.");
    }
    if (changes.chatgptFullConversation && changes.chatgptFullConversation.newValue === undefined) {
      fullConversation = [];
      console.log("Global 'fullConversation' cleared via storage.onChanged.");
    }
  }
});

// 초기 실행
observeDOM();
attachConversationObserver();
console.log('👀 DOM observer activated!');
