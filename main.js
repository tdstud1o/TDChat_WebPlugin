// ==UserScript==
// @name         TDChat Authorization and Letter Processing Helper
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  A script to help with TDChat authorization and letter processing
// @author       Timmoc
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-end
// ==/UserScript==

(function() {
  "use strict";

  // 常量
  const UUID = "TAH";
  const BASE_URL = "http://127.0.0.1:12915/api/local/";

  // 申请 token 模块
  function requestTokenModule() {
    if (window.top !== window.self) {
      GM_log("Script Auth rejected. Exiting...");
      return;
    }
    if (GM_getValue("rejected")) {
      GM_log("Script Auth rejected. Exiting...");
      return;
    }

    function main() {
      const token = GM_getValue("token");
      const password = GM_getValue("password");

      GM_log("Checking authorization status...");
      GM_log(`Stored token: ${token}`);
      GM_log(`Stored password: ${password}`);

      if (token) {
        GM_log("Token exists. No need to request or show popup.");
      } else if (password) {
        GM_log("Password exists. Showing popup without requesting token.");
        createFloatingWindow();
      } else {
        GM_log("No stored password or token found. Generating password and requesting new authorization...");
        requestAuthorization();
      }
    }

    function requestAuthorization() {
      const password = generateRandomPassword();

      GM_log(`Generated new password: ${password}`);
      GM_log("Requesting new authorization...");

      GM_xmlhttpRequest({
        method: "POST",
        url: BASE_URL + "issueToken",
        data: JSON.stringify({ uuid: UUID, password: password }),
        headers: {
          "Content-Type": "application/json"
        },
        onload: function(response) {
          GM_log(`Response from issueToken: ${response.responseText}`);
          const result = JSON.parse(response.responseText);
          if (response.status === 200) {
            if (result.letter && result.letter.message) {
              GM_log("Authorization request success. Showing popup for user approval.");
              GM_setValue("password", password);
              createFloatingWindow();
            } else {
              alert("存在token但是不存在密码，请在TDChat清除token。");
            }
          } else {
            alert("Token 发放失败: " + result.error);
          }
        },
        onerror: function() {
          GM_log("Authorization request failed. Please check your network connection or if TDChat is running.");
          createFloatingWindow();
        }
      });
    }

    function createFloatingWindow() {
      if (document.querySelector("#tdchat-floating-window")) {
        GM_log("Floating window already exists. Skipping creation.");
        return;
      }

      const floatingWindow = document.createElement("div");
      floatingWindow.id = "tdchat-floating-window";
      floatingWindow.style.position = "fixed";
      floatingWindow.style.bottom = "10px";
      floatingWindow.style.right = "10px";
      floatingWindow.style.width = "200px";
      floatingWindow.style.height = "100px";
      floatingWindow.style.background = "#fff";
      floatingWindow.style.border = "1px solid #ccc";
      floatingWindow.style.borderRadius = "10px";
      floatingWindow.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.2)";
      floatingWindow.style.zIndex = "999999";
      floatingWindow.style.display = "flex";
      floatingWindow.style.flexDirection = "column";
      floatingWindow.style.alignItems = "center";
      floatingWindow.style.justifyContent = "center";
      floatingWindow.style.cursor = "grab";

      const bubbleText = document.createElement("div");
      bubbleText.style.textAlign = "center";
      bubbleText.style.marginBottom = "10px";
      bubbleText.textContent = "打开您的TDChat应用同意我们使用您的身份行动";
      floatingWindow.appendChild(bubbleText);

      const checkAuthButton = document.createElement("button");
      checkAuthButton.textContent = "检查授权";
      checkAuthButton.style.marginRight = "10px";
      checkAuthButton.addEventListener("click", checkAuthorization);

      const rejectAuthButton = document.createElement("button");
      rejectAuthButton.textContent = "拒绝授权";
      rejectAuthButton.addEventListener("click", () => {
        GM_log("Authorization rejected by user.");
        GM_setValue("rejected", true);
        floatingWindow.remove();
      });

      const buttonContainer = document.createElement("div");
      buttonContainer.style.display = "flex";
      buttonContainer.appendChild(checkAuthButton);
      buttonContainer.appendChild(rejectAuthButton);

      floatingWindow.appendChild(buttonContainer);

      document.body.appendChild(floatingWindow);

      let isDragging = false;
      let offsetX, offsetY;

      floatingWindow.addEventListener("mousedown", (e) => {
        isDragging = true;
        offsetX = e.clientX - floatingWindow.getBoundingClientRect().left;
        offsetY = e.clientY - floatingWindow.getBoundingClientRect().top;
      });

      document.addEventListener("mousemove", (e) => {
        if (isDragging) {
          floatingWindow.style.left = `${e.clientX - offsetX}px`;
          floatingWindow.style.top = `${e.clientY - offsetY}px`;
        }
      });

      document.addEventListener("mouseup", () => {
        isDragging = false;
      });
    }

    function checkAuthorization() {
      const password = GM_getValue("password");
      GM_log(`Retrieved password: ${password}`);

      if (!password) {
        GM_log("Failed to retrieve password. Please reload the page.");
        return;
      }

      GM_log("Checking authorization with TDChat...");
      GM_xmlhttpRequest({
        method: "POST",
        url: BASE_URL + "getToken",
        data: JSON.stringify({ uuid: UUID, password: password }),
        headers: {
          "Content-Type": "application/json"
        },
        onload: function(response) {
          GM_log(`Response from getToken: ${response.responseText}`);
          const result = JSON.parse(response.responseText);
          if (result.letter && result.letter.token && result.letter.isValid) {
            GM_setValue("token", result.letter.token);
            GM_log("Authorization successful! Token saved.");
            document.querySelector("#tdchat-floating-window").remove();
          } else {
            GM_log("Authorization failed. Please check TDChat.");
          }
        },
        onerror: function() {
          GM_log("Failed to check authorization. Please check your network connection.");
        }
      });
    }

    function generateRandomPassword() {
      return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
          (c ^ Math.random() * 16 >> c / 4).toString(16)
      );
    }

    GM_log("TDChat Authorization Helper script initialized.");
    main();
  }

  // 处理与生成信件模块
  function processLetterModule() {
    const token = GM_getValue("token");
    if (!token) {
      GM_log("No valid token found. Cannot process letter.");
      return;
    }

    const containers = document.querySelectorAll(".tdl-container[data-secret]");
    containers.forEach(container => {
      const secret = container.getAttribute("data-secret");
      try {
        const secretData = JSON.parse(secret);

        GM_log("Parsing letter with secret data...");
        GM_xmlhttpRequest({
          method: "POST",
          url: BASE_URL + "parseLetter",
          data: JSON.stringify(secretData),
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          onload: function(response) {
            GM_log(`Response from parseLetter: ${response.responseText}`);
            const result = JSON.parse(response.responseText);
            if (result.letter && result.letter.messageChain && result.letter.messageChain.length > 0) {
              const firstMessage = result.letter.messageChain.find(msg => msg.type === "poc_rawHtml");
              if (firstMessage) {
                container.innerHTML = firstMessage.text; // 显示解析后的内容
                container.style.display = "block"; // 显示容器
              } else {
                const firstMessage = result.letter.messageChain.find(msg => msg.type === "text");
                if (firstMessage) {
                  container.innerHTML = firstMessage.text; // 显示解析后的内容
                  container.style.display = "block"; // 显示容器
                }
              }
            } else {
              GM_log("No valid messageChain found in response.");
            }
          },
          onerror: function() {
            GM_log("Failed to parse letter. Please check your network connection.");
          }
        });
      } catch (error) {
        GM_log(`Failed to parse secret data: ${error.message}`);
      }
    });
  }

  // 初始化脚本
  requestTokenModule();
  processLetterModule(); // 调用处理与生成信件模块
})();