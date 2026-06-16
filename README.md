# TDChat Web助手

本项目旨在建立与TDChat链接，调用TDLetter的加解密功能以供浏览器使用。

## 使用格式

```html
<div class="tdl-container" data-secret="此处为加密信件">此处为解密后信件</div>
```

## 安全机制

- **XSS 防护**：text 类型消息使用 `textContent` 渲染；`poc_rawHtml` 类型消息通过 DOMPurify 净化后渲染
- **Shadow DOM**：浮动授权窗口使用 Shadow DOM 隔离，不受宿主页面 CSS 影响
- **密码学安全随机数**：授权密码使用 `crypto.getRandomValues()` 生成
- **Token 错误容忍**：仅在 401/403 时清除 token 要求重新授权，网络错误不清除
- **懒加载检测**：使用 MutationObserver 监听动态插入的 `.tdl-container`，支持 SPA 页面

## 架构说明

插件本身不持有任何密钥。加解密操作委托给本地运行的 TDChat CLI 服务（默认 `127.0.0.1:12915`），密钥仅存在于 TDChat CLI 本地存储中。插件仅持有一个可吊销的访问 token。

## 服务端安全建议（TODO）

- 本地服务端应增加 CORS 白名单，仅接受来自可信 origin 的请求
- 考虑增加请求频率限制，防止本地恶意程序暴力枚举 token
- 建议将 `@match` 从 `*://*/*` 收敛到实际使用 TDChat 信件的站点列表

## 待优化

- 更完善的用户界面和错误提示
- 更多消息类型解析支持
- 服务端 CORS 白名单实现
