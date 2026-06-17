// ==UserScript==
// @name         TDChat Authorization and Letter Processing Helper
// @namespace    http://tampermonkey.net/
// @version      0.6.2
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
// @require      https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js
// @updateURL    https://raw.gitcode.com/Timmoc/TDChat_WebPlugin/raw/master/main.user.js
// @downloadURL  https://raw.gitcode.com/Timmoc/TDChat_WebPlugin/raw/master/main.user.js
// ==/UserScript==

(function () {
    "use strict";

    // 常量
    const UUID = "TAH";
    const BASE_URL = "http://127.0.0.1:12915/api/local/";
    const MAX_RETRY = 3;
    const RETRY_DELAY_MS = 2000;

    // ============================================================
    // 工具函数
    // ============================================================

    /**
     * 密码学安全的随机密码生成（替代 Math.random）
     * 生成一个 UUID v4 格式的随机字符串
     */
    function generateSecurePassword() {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        // 设置 UUID v4 版本位
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
        return [
            hex.slice(0, 8),
            hex.slice(8, 12),
            hex.slice(12, 16),
            hex.slice(16, 20),
            hex.slice(20, 32)
        ].join("-");
    }

    /**
     * 安全渲染 HTML 内容到容器
     * - text 类型：使用 textContent（完全转义）
     * - poc_rawHtml 类型：使用 DOMPurify 净化后渲染
     */
    function safeRender(container, message) {
        if (message.type === "text") {
            container.textContent = message.text;
        } else if (message.type === "poc_rawHtml") {
            if (typeof DOMPurify !== "undefined") {
                container.innerHTML = DOMPurify.sanitize(message.text, {
                    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li", "code", "pre", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "span", "div", "img", "table", "thead", "tbody", "tr", "th", "td"],
                    ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "target", "rel"],
                    ALLOW_DATA_ATTR: false,
                    ADD_ATTR: ["target"],
                });
            } else {
                // DOMPurify 不可用时降级为纯文本
                GM_log("DOMPurify not available, falling back to textContent");
                container.textContent = message.text;
            }
        } else {
            container.textContent = message.text;
        }
        container.style.display = "block";
    }

    // ============================================================
    // 授权模块
    // ============================================================

    function requestTokenModule() {
        if (window.top !== window.self) {
            GM_log("Script Auth rejected (iframe). Exiting...");
            return;
        }
        if (GM_getValue("rejected")) {
            GM_log("Script Auth rejected by user. Exiting...");
            return;
        }

        function main() {
            const token = GM_getValue("token");
            const password = GM_getValue("password");

            GM_log("Checking authorization status...");

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
            const password = generateSecurePassword();

            GM_log("Requesting new authorization...");

            GM_xmlhttpRequest({
                method: "POST",
                url: BASE_URL + "issueToken",
                data: JSON.stringify({ uuid: UUID, password: password }),
                headers: {
                    "Content-Type": "application/json"
                },
                onload: function (response) {
                    GM_log("Response from issueToken: " + response.responseText);
                    if (response.status === 200) {
                        GM_log("Authorization request success. Showing popup for user approval.");
                        GM_setValue("password", password);
                        createFloatingWindow();
                    } else {
                        alert("存在token但是不存在密码，请在TDChat清除token。");
                    }
                },
                onerror: function () {
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

            // 使用 Shadow DOM 隔离样式
            const host = document.createElement("div");
            host.id = "tdchat-floating-window";
            host.style.position = "fixed";
            host.style.bottom = "10px";
            host.style.right = "10px";
            host.style.zIndex = "999999";
            document.body.appendChild(host);

            const shadow = host.attachShadow({ mode: "closed" });

            const style = document.createElement("style");
            style.textContent = `
                .floating-panel {
                    width: 220px;
                    padding: 16px;
                    background: #fff;
                    border: 1px solid #ccc;
                    border-radius: 10px;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    font-size: 13px;
                    color: #333;
                    cursor: grab;
                    user-select: none;
                }
                .floating-panel p {
                    text-align: center;
                    margin: 0 0 12px 0;
                    line-height: 1.4;
                }
                .btn-row {
                    display: flex;
                    justify-content: center;
                    gap: 8px;
                }
                .btn-row button {
                    padding: 6px 14px;
                    border: 1px solid #ccc;
                    border-radius: 6px;
                    background: #f5f5f5;
                    cursor: pointer;
                    font-size: 13px;
                }
                .btn-row button:hover {
                    background: #e8e8e8;
                }
                .btn-row button.primary {
                    background: #4a90d9;
                    color: #fff;
                    border-color: #4a90d9;
                }
                .btn-row button.primary:hover {
                    background: #3a7bc8;
                }
                .btn-row button.danger {
                    color: #d9534f;
                    border-color: #d9534f;
                }
            `;
            shadow.appendChild(style);

            const panel = document.createElement("div");
            panel.className = "floating-panel";

            const bubbleText = document.createElement("p");
            bubbleText.textContent = "打开您的TDChat应用同意我们使用您的身份行动";
            panel.appendChild(bubbleText);

            const btnRow = document.createElement("div");
            btnRow.className = "btn-row";

            const checkBtn = document.createElement("button");
            checkBtn.className = "primary";
            checkBtn.textContent = "检查授权";
            checkBtn.addEventListener("click", checkAuthorization);

            const rejectBtn = document.createElement("button");
            rejectBtn.className = "danger";
            rejectBtn.textContent = "拒绝授权";
            rejectBtn.addEventListener("click", () => {
                GM_log("Authorization rejected by user.");
                GM_setValue("rejected", true);
                host.remove();
            });

            btnRow.appendChild(checkBtn);
            btnRow.appendChild(rejectBtn);
            panel.appendChild(btnRow);
            shadow.appendChild(panel);

            // 拖拽逻辑
            let isDragging = false;
            let offsetX, offsetY;

            panel.addEventListener("mousedown", (e) => {
                isDragging = true;
                offsetX = e.clientX - host.getBoundingClientRect().left;
                offsetY = e.clientY - host.getBoundingClientRect().top;
                panel.style.cursor = "grabbing";
            });

            document.addEventListener("mousemove", (e) => {
                if (isDragging) {
                    host.style.left = (e.clientX - offsetX) + "px";
                    host.style.top = (e.clientY - offsetY) + "px";
                    host.style.bottom = "auto";
                    host.style.right = "auto";
                }
            });

            document.addEventListener("mouseup", () => {
                isDragging = false;
                panel.style.cursor = "grab";
            });
        }

        function checkAuthorization() {
            const password = GM_getValue("password");
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
                onload: function (response) {
                    GM_log("Response from getToken: " + response.responseText);
                    try {
                        const result = JSON.parse(response.responseText);
                        if (result.code === 200 && result.data && result.data.isValid && result.data.token) {
                            GM_setValue("token", result.data.token);
                            GM_log("Authorization successful! Token saved.");
                            const host = document.querySelector("#tdchat-floating-window");
                            if (host) host.remove();
                            // 授权成功后立即处理页面上的信件
                            processLetterModule();
                        } else {
                            GM_log("Authorization not yet approved. Please approve in TDChat and try again.");
                        }
                    } catch (e) {
                        GM_log("Failed to parse getToken response: " + e.message);
                    }
                },
                onerror: function () {
                    GM_log("Failed to check authorization. Please check your network connection.");
                }
            });
        }

        GM_log("TDChat Authorization Helper script initialized.");
        main();
    }

    // ============================================================
    // 信件处理模块
    // ============================================================

    function processLetterModule() {
        const token = GM_getValue("token");
        if (!token) {
            GM_log("No valid token found. Cannot process letter.");
            return;
        }

        const containers = document.querySelectorAll(".tdl-container[data-secret]");
        if (containers.length === 0) {
            return; // 页面上没有 TDL 容器，静默退出
        }

        containers.forEach(container => {
            // 跳过已处理的容器
            if (container.dataset.tdlProcessed === "true") return;
            container.dataset.tdlProcessed = "true";

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
                        "Authorization": "Bearer " + token
                    },
                    onload: function (response) {
                        GM_log("Response from parseLetter: " + response.responseText);
                        try {
                            const result = JSON.parse(response.responseText);
                            if (result.letter && result.letter.messageChain && result.letter.messageChain.length > 0) {
                                // 优先查找 rawHtml，其次 text
                                const rawHtmlMsg = result.letter.messageChain.find(msg => msg.type === "poc_rawHtml");
                                const textMsg = result.letter.messageChain.find(msg => msg.type === "text");
                                const targetMsg = rawHtmlMsg || textMsg;
                                if (targetMsg) {
                                    safeRender(container, targetMsg);
                                } else {
                                    GM_log("No renderable message found in messageChain.");
                                }
                            } else {
                                GM_log("No valid messageChain found in response.");
                                // 不激进清除 token，仅记录日志
                                handleTokenError("Invalid parseLetter response", response.status);
                            }
                        } catch (e) {
                            GM_log("Failed to parse response JSON: " + e.message);
                        }
                    },
                    onerror: function () {
                        GM_log("Failed to parse letter. Please check your network connection or if TDChat is running.");
                    }
                });
            } catch (error) {
                GM_log("Failed to parse secret data: " + error.message);
            }
        });
    }

    /**
     * Token 错误处理：区分可恢复和不可恢复错误
     * - 401/403: token 无效，需要重新授权
     * - 其他错误: 不清除 token，等待重试
     */
    function handleTokenError(reason, statusCode) {
        if (statusCode === 401 || statusCode === 403) {
            GM_log("Token invalid (HTTP " + statusCode + "). Clearing token for re-authorization.");
            GM_setValue("token", null);
        } else {
            GM_log("Token error (reason: " + reason + ", status: " + statusCode + "). Keeping token for retry.");
        }
    }

    // ============================================================
    // 页面监听：MutationObserver 懒加载检测 .tdl-container
    // ============================================================

    function setupObserver() {
        const token = GM_getValue("token");
        if (!token) return;

        // 先处理页面加载时已存在的容器
        processLetterModule();

        // 监听动态插入的容器（SPA、异步渲染等）
        const observer = new MutationObserver((mutations) => {
            let hasNewContainers = false;
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.classList && node.classList.contains("tdl-container") ||
                            node.querySelector && node.querySelector(".tdl-container[data-secret]")) {
                            hasNewContainers = true;
                            break;
                        }
                    }
                }
                if (hasNewContainers) break;
            }
            if (hasNewContainers) {
                processLetterModule();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // ============================================================
    // 初始化
    // ============================================================

    requestTokenModule();
    setupObserver();

})();
