// 문장 단위로 포매팅하는 함수 (코드 내 '!=' 등 연산자는 영향을 주지 않도록 함)
function formatTextForMarkdown(text) {
  // 아래 정규식은 마침표, 느낌표, 물음표 뒤에 공백이 있을 경우 줄바꿈을 넣습니다.
  // 단, 연산자(예: !=, ==, <= 등)로 연결된 경우에는 앞뒤에 특정 기호가 있다면 줄바꿈하지 않도록 (부정적 lookbehind/lookahead 사용)
  // 다만 이 정규식은 모든 경우를 완벽하게 잡아내지는 못할 수 있으므로 필요에 따라 추가 조정이 필요합니다.

  return text.replace(/(?<![=!<>])([.!?])\s+(?![=!<>])/g, "$1\n\n");
}

// 질문 내역 다운로드 기능
document.getElementById('saveButton').addEventListener('click', () => {
  chrome.storage.local.get(['chatgptQuestions'], (result) => {
    let questions = result.chatgptQuestions;
    
    if (!questions || questions.length === 0) {
      alert('저장된 질문 데이터가 없습니다!');
      return;
    }
    
    let markdownText = "# 오늘의 질문 내역\n\n";
    
    questions.forEach(item => {
      // 메시지 내 문장 단위 분리를 위해 후처리
      let formattedText = formatTextForMarkdown(item.text);
      markdownText += `## ${item.time}\n\n`;
      markdownText += formattedText + "\n\n";
    });
    
    const blob = new Blob([markdownText], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().split('T')[0];
    const filename = `${today}-chatgpt-questions.md`;
    
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error("Download error:", chrome.runtime.lastError.message);
      } else {
        console.log("Download started, ID:", downloadId);
      }
      setTimeout(() => { URL.revokeObjectURL(url); }, 3000);
    });
  });
});

// 전체 대화 내역 다운로드 기능
document.getElementById('saveFullButton').addEventListener('click', () => {
  chrome.storage.local.get(['chatgptFullConversation'], (result) => {
    let conversation = result.chatgptFullConversation;
    
    if (!conversation || conversation.length === 0) {
      alert('저장된 전체 대화 데이터가 없습니다!');
      return;
    }
    
    let markdownText = "# 전체 대화 내역\n\n";
    let previousSpeaker = "";
    
    conversation.forEach(item => {
      let formattedText = formatTextForMarkdown(item.text);
      
      // 스피커가 바뀌면 헤더를 추가합니다.
      if (item.type !== previousSpeaker) {
        previousSpeaker = item.type;
        if (previousSpeaker === "user") {
          markdownText += `## 내 질문 (${item.time})\n\n`;
        } else if (previousSpeaker === "gpt") {
          markdownText += `## GPT의 답변 (${item.time})\n\n`;
        }
      }
      markdownText += formattedText;
      
      // 조건에 따라 공백을 추가: 유저 메시지 후 한 줄, GPT 메시지 후 세 줄
      if (item.type === "user") {
        markdownText += "\n\n";
      } else if (item.type === "gpt") {
        markdownText += "\n\n\n";
      }
    });
    
    const blob = new Blob([markdownText], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().split('T')[0];
    const filename = `${today}-chatgpt-full-conversation.md`;
    
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error("Download error:", chrome.runtime.lastError.message);
      } else {
        console.log("Download started, ID:", downloadId);
      }
      setTimeout(() => { URL.revokeObjectURL(url); }, 3000);
    });
  });
});

// 저장된 내역 삭제 기능 (확인 대화 포함)
document.getElementById('clearStorageButton').addEventListener('click', () => {
  if (confirm("이전 내역이 모두 삭제됩니다. 삭제하시겠습니까?")) {
    chrome.storage.local.remove(['chatgptQuestions', 'chatgptFullConversation'], () => {
      console.log("저장된 내역이 삭제되었습니다.");
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length > 0) {
          chrome.tabs.reload(tabs[0].id, () => {
            console.log("탭이 새로고침되었습니다.");
          });
        }
      });
    });
  }
});


// 가이드
document.getElementById('infoBtn').addEventListener('click', () => {
  alert(
    "ChatGPT Log Indexer 가이드\n\n" +
    "1) 질문 내역 저장하기\n" +
    "해당 세션에서의 사용자의 질문 내역을 Markdown 파일로 저장\n\n" +
    "2) 전체 대화 저장하기\n" +
    "해당 세션의 전체 대화 (질문+답변) 기록을 Markdown 파일로 저장\n\n" +
    "3) 저장된 내역 삭제하기\n" +
    "새로운 세션에 들어가면 삭제 후 채팅 시작\n\n" +
    "4) 저장된 질문 목록에서 작성할 TIL, WIL 질문을 추리고 전체 내역에서 해당 내용 확인하기.\n\n" +
    "그 외 상세내용은 설치 및 사용법.txt 참고\n"
  );
});

// 다크모드/라이트트모드 전환 및 상태 유지 기능
function updateModeUI(isDarkMode) {
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    document.getElementById('modeToggleBtn').innerText = "라이트 모드";
    // 다크 모드: 버튼을 라이트트 모드로 전환할 수 있도록, 버튼은 밝은 색으로 설정
    modeToggleBtn.style.backgroundColor = "#dddddd"; 
    modeToggleBtn.style.color = "#333333";           
    modeToggleBtn.innerText = "라이트 모드";
    }
  else {
    document.body.classList.remove('dark-mode');
    document.getElementById('modeToggleBtn').innerText = "다크 모드";
    // 라이트 모드: 버튼을 다크 모드로 전환할 수 있도록, 버튼은 어두운 색으로 설정
    modeToggleBtn.style.backgroundColor = "#424242";   
    modeToggleBtn.style.color = "#ffffff";             
    modeToggleBtn.innerText = "다크 모드";
  }
}
chrome.storage.local.get(['darkMode'], (result) => {
  let isDarkMode = result.darkMode || false;
  updateModeUI(isDarkMode);
});
// 다크모드 토글 버튼 이벤트 리스너
document.getElementById('modeToggleBtn').addEventListener('click', () => {
  chrome.storage.local.get(['darkMode'], (result) => {
    let isDarkMode = result.darkMode || false;
    isDarkMode = !isDarkMode; // 모드 토글
    chrome.storage.local.set({ darkMode: isDarkMode }, () => {
      updateModeUI(isDarkMode);
    });
  });
});