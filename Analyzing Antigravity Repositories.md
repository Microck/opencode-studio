# **Architectural Deconstruction of Antigravity Reverse-Engineering Frameworks: A Comprehensive Analysis of Account Orchestration and Protocol Interoperability**

## **1\. Introduction: The Emergence of the Antigravity Ecosystem**

The contemporary landscape of software development tools is currently undergoing a radical transformation driven by the integration of large language models (LLMs) into the integrated development environment (IDE). Central to this shift is Google’s internal platform, codenamed "Antigravity," which represents a paradigm shift from simple code completion to "agentic" development. This platform, powered by the Gemini 3 model family, offers capabilities that transcend traditional text generation, introducing "Thinking" blocks—visible chains of thought that precede code generation—and deep integration with Google’s cloud infrastructure. However, the deployment of these advanced capabilities is currently constrained by strict access controls, invite-only preview periods, and aggressive rate limiting designed to manage the computational load of these frontier models.

In response to these constraints, a sophisticated ecosystem of independent, open-source software has emerged. This report provides an exhaustive technical analysis of five specific repositories that constitute the vanguard of this reverse-engineering effort: Antigravity-Manager, AntigravityQuotaWatcher, antigravity-agent, opencode-antigravity-auth, and opencode-gemini-auth. These tools do not merely exist as isolated utilities; rather, they form a cohesive "shadow infrastructure" that enables developers to federalize access, monitor consumption in real-time, and bridge proprietary internal APIs with open-standard clients.

The primary functional objective driving the development of these tools is "Quota Arbitrage." By decoupling the user interface from the underlying authentication identity, these tools allow a single developer to aggregate the "free tier" or "preview" quotas of multiple Google accounts, effectively synthesizing a high-throughput, enterprise-grade access tier from consumer-grade components. This report will systematically deconstruct the architecture of each repository, analyzing how they intercept OAuth flows, manipulate internal API payloads, and manage session state across distributed environments. Furthermore, it will synthesize these findings into a rigorous engineering guide, detailing the methodologies required to replicate these architectures for research and interoperability purposes.

## **2\. The Target Architecture: Google Antigravity and Gemini 3**

To fully comprehend the mechanisms employed by the repositories in question, it is essential to first establish a detailed technical baseline of the system they target. "Antigravity" is not simply a model endpoint; it is a comprehensive "agentic IDE" environment, often referred to by the internal codename "Jetski" or associated with the "Windsurf" IDE fork.1 It is built to host the Gemini 3 Pro and Gemini 3 Flash models, which differ fundamentally from their predecessors in their reasoning architecture.

### **2.1 The Incentive Structure: Quota vs. Billing**

The economic and technical incentives for reverse-engineering this platform are rooted in the distinction between API billing and IDE quotas.

* **Vertex AI/Gemini API:** Accessing Gemini 3 via standard Google Cloud APIs (Vertex AI) incurs a direct cost per million tokens.2 While scalable, this cost can become prohibitive for individual developers running continuous, agentic loops that require massive context windows and iterative reasoning steps.  
* **Antigravity IDE Quota:** To drive adoption of its new developer tools, Google typically provisions Antigravity accounts with a specific "seat" quota. This quota is often defined by a number of requests or "thinking hours" per week or day, rather than a direct monetary charge.3  
* **The Arbitrage Opportunity:** The tools analyzed in this report exploit the discrepancy between these two models. By automating the creation and rotation of multiple "free" IDE accounts, they allow a user to utilize the Gemini 3 models at a volume that would otherwise cost significant sums via the Vertex API. This creates a powerful "Quota Arbitrage" dynamic, where the technical complexity of managing multiple accounts is traded for free computational resources.

### **2.2 Technical Characteristics of the Endpoint**

The Antigravity endpoint presents several unique technical challenges that these repositories must overcome. Unlike a standard REST API that accepts a prompt and returns a string, the Antigravity service utilizes a complex, multi-modal interaction model.

#### **2.2.1 The "Thinking" Block Protocol**

Gemini 3 introduces "Thinking" blocks (CoT), which are structured data segments returned *before* the final answer. The API response is not a single text stream but a multipart stream containing:

1. **Thought Chunks:** Encoded segments representing the model's internal reasoning.  
2. **Thinking Level Configuration:** Parameters such as thinkingLevel (set to low, high, or minimal) and thinkingBudget (token limits) that control the depth of this reasoning.5  
3. **Content Chunks:** The final output intended for the user.

Any tool attempting to interface with this endpoint, such as opencode-antigravity-auth, must be capable of parsing this non-standard stream. It must distinguish between a "thought" and a "response," and potentially format the "thought" for display in a CLI or IDE without breaking the standard output parsers that expect simple Markdown.8

#### **2.2.2 OAuth Scope Isolation**

Accessing the Antigravity infrastructure requires more than a simple API key. It necessitates a valid Google OAuth 2.0 token with specific, often internal, scopes. The analysis of opencode-antigravity-auth reveals reliance on scopes such as https://www.googleapis.com/auth/cloudaicompanion or permissions related to cloudaicompanion.companions.generateChat.8 These scopes identify the client not as a generic API consumer, but as a trusted instance of the Antigravity or Windsurf IDE. This distinction is critical; standard Google Cloud credentials will often fail to authenticate against these endpoints, necessitating the "impersonation" techniques observed in the repositories.

#### **2.2.3 Session Continuity and State**

Unlike stateless HTTP requests, the agentic nature of Antigravity implies a stateful session. The server maintains a "workspace" context, remembering previous interactions, file context, and variable states.9 The client tools must therefore manage long-lived session tokens (refresh\_token) and handle the "workspace ID" mapping to ensure that new requests are routed to the correct conversational thread.

## ---

**3\. Deep Analysis of Account Orchestration Repositories**

The first and most complex category of tools focuses on the logistical challenge of maintaining high-availability access through account federation. This is exemplified by lbjlaq/Antigravity-Manager and MonchiLin/antigravity-agent. These tools act as a virtualization layer, abstracting the concept of a "user account" into a "resource pool."

### **3.1 Repository: lbjlaq/Antigravity-Manager**

**Repository Overview:** lbjlaq/Antigravity-Manager is a robust desktop application designed to virtualize the user identity presented to the Antigravity service.10 Its primary function is to serve as a local proxy that aggregates multiple Google accounts, automatically rotating between them to bypass individual rate limits.

#### **3.1.1 Architectural Foundation: The Tauri-Rust Bridge**

The application is built using **Tauri v2**, a modern framework that combines a web-based frontend (React) with a compiled native backend (Rust).11 This architectural choice is not arbitrary; it addresses specific technical requirements for a tool of this nature.

* **System-Level I/O:** Rust provides safe, high-performance access to the file system and network stack. This is essential for securely reading/writing encrypted token stores and handling the high-throughput, concurrent network requests required when proxying traffic for an IDE.  
* **Security and Memory Safety:** Handling authentication tokens requires rigorous memory safety to prevent leaks. Rust’s ownership model ensures that sensitive strings (like Refresh Tokens) are handled securely in memory and dropped immediately when no longer needed, reducing the attack surface compared to garbage-collected languages like JavaScript/Node.js used in Electron.  
* **Resource Efficiency:** Unlike Electron, which bundles a full Chromium and Node.js runtime, Tauri relies on the operating system's native webview (WebView2 on Windows, WebKit on macOS). This results in a significantly smaller binary size and lower memory footprint, allowing the "Manager" to run in the background without competing for resources with the heavy IDEs it supports.

#### **3.1.2 The "Model Router" and "Dispatcher" Logic**

The core intellectual property of Antigravity-Manager lies in its request routing logic, visualized in the repository as a "Dispatcher" system.11 The request lifecycle is a sophisticated exercise in traffic shaping:

1\. The Local Gateway:  
The application initializes a local HTTP server (using the Axum web framework in Rust) listening on a specific port (e.g., localhost:11434 or similar). This server exposes an API compatible with standard protocols like OpenAI or Anthropic. This is a critical interoperability feature: it allows any tool that supports OpenAI (NextChat, Cursor, generic CLI agents) to connect to Antigravity-Manager as if it were a standard provider.  
2\. The Dispatcher (Rotation Logic):  
When a request hits the gateway, it is not immediately forwarded. Instead, it passes to the Dispatcher component. The Dispatcher maintains the state of all configured accounts, tracking metrics such as:

* last\_used\_timestamp: To enforce fair usage or cooldowns.  
* current\_status: (Active, Cooldown, Expired).  
* usage\_counter: Tracking requests against known limits.

The Dispatcher employs a rotation algorithm—likely Round Robin or Weighted Least Connections—to select the optimal account for the current request. If the primary account is marked as "Cooldown" (due to a recent 429 error), the Dispatcher seamlessly selects the next available account. This abstraction renders the rate limit invisible to the client application.

3\. Request Mapping (Translation Layer):  
Once an account is selected, the "Request Mapper" component translates the generic input (e.g., an OpenAI chat.completions JSON payload) into the specific internal format required by Antigravity.11

* It injects the specific model parameters (e.g., gemini-3-pro).  
* It attaches the Authorization: Bearer \<token\> header belonging to the *selected* account.  
* It may also inject "Thinking" configurations (thinkingLevel: "high") if configured by the user, translating OpenAI's temperature or top\_p parameters into their Gemini equivalents.

4\. Response Mapping and Error Interception:  
The "Response Mapper" handles the return trip. Crucially, it inspects the HTTP status code from Google.

* **Success (200 OK):** The response is translated back to the client's expected format (e.g., OpenAI SSE stream).  
* **Rate Limit (429 Too Many Requests):** This is where the magic happens. The Mapper catches this error *internal* to the proxy. It signals the Dispatcher to mark the current account as "Cooldown," selects a *new* account, and immediately retries the request. The client application never sees the 429 error; it only experiences a slight latency increase as the retry occurs. This is the definition of "seamless" account switching.

#### **3.1.3 Storage and Persistence Strategy**

The file structure analysis 13 indicates a strict separation of concerns. The src-tauri directory contains the logic for secure storage. The application likely utilizes the operating system's native keyring (via Rust crates like keyring) or an encrypted local database (like SQLite with SQLCipher or a simple JSON file protected by OS-level permissions) to store the long-lived refresh\_token for each account. This ensures that even if the configuration file is accessed, the credentials are not immediately usable without the decryption key managed by the Rust backend.

### ---

**3.2 Repository: MonchiLin/antigravity-agent**

**Repository Overview:** While sharing similar goals with the Manager, MonchiLin/antigravity-agent adopts a different user experience philosophy. It is designed as a "bridge" agent that focuses on seamless workflow integration directly within the VS Code environment.14

#### **3.2.1 Workflow Automation: Webview Token Extraction**

One of the most friction-heavy aspects of multi-account management is the initial login. antigravity-agent automates this using a "Webview Token Extraction" technique.

* **The Mechanism:** Instead of asking the user to manually paste tokens, the desktop agent opens a webview window directed to the Google login page. The user performs a standard login.  
* **Interception:** Once the login completes, the agent (running with elevated privileges as a desktop app) inspects the webview's storage—specifically the Cookies and LocalStorage. It looks for specific authentication artifacts (such as the SID, HSID, or specific OAuth tokens stored in the browser session).  
* **Advantages:** This allows the tool to obtain a valid session without requiring a public API key or a complex manual extraction process by the user. It effectively "hijacks" the legitimate browser session initiated by the user.

#### **3.2.2 IPC Architecture: The VS Code Link**

The repository structure reveals a clear dichotomy: src-tauri (Rust backend) and vscode-extension (Frontend).

* **Inter-Process Communication (IPC):** The VS Code extension cannot directly access the secure storage or the background webview. Instead, it relies on a local communication channel—likely via standard output/input (stdio), local sockets, or a local HTTP server exposed by the agent.  
* **Dynamic Injection:** When the developer opens a file in VS Code, the extension queries the running antigravity-agent for the "active" account's token. It then injects this token into the editor's environment or language server configuration on the fly. This decouples the editor (which just needs *a* token) from the complex logic of *managing* tokens.

#### **3.2.3 Security: Encrypted Vaults**

The documentation emphasizes "password-encrypted backups".14 This suggests the implementation of a portable vault format.

* **Serialization:** The agent serializes the state of all managed accounts (tokens, usage stats, cookies) into a binary blob.  
* **Encryption:** This blob is encrypted using a user-provided password (likely using AES-256-GCM).  
* **Portability:** This allows a user to "carry" their farm of 10+ Google accounts from their office machine to their laptop simply by transferring this encrypted file, ensuring continuity of the "infinite quota" environment.

## ---

**4\. Deep Analysis of Monitoring Tools**

The second functional category addresses the problem of "Observability." The Antigravity quota system is opaque; users often do not know they are close to a limit until the request fails. wusimpl/AntigravityQuotaWatcher solves this.

### **4.1 Repository: wusimpl/AntigravityQuotaWatcher**

**Repository Overview:** This is a Visual Studio Code extension dedicated to the real-time monitoring and visualization of Antigravity AI model quotas.15

#### **4.1.1 Dual-Mode Data Acquisition**

The extension employs two distinct, highly clever strategies for gathering data, revealing significant insights into the operation of the Antigravity IDE.

Mechanism A: Language Server Protocol (LSP) Sniffing  
The documentation describes relying on "internal implementation details of the Antigravity language server" to detect service ports.15

* **The "Sidecar" Discovery:** When the official Antigravity extension runs in VS Code, it launches a local binary (the Language Server) to handle code analysis and AI completion. This binary often opens a local HTTP port (e.g., localhost:54321) to serve requests from the editor frontend.  
* **Process Scanning:** AntigravityQuotaWatcher likely scans the local process table or probes a range of known ports to identify this hidden server.  
* **Piggybacking:** Once the port is found, the watcher sends queries directly to it (e.g., GET /v1/quota). Because the Language Server is already authenticated (it holds the user's session), the watcher does not need its own credentials. It "piggybacks" on the existing authenticated tunnel created by the official extension. This is a classic "Living off the Land" technique in reverse engineering.

Mechanism B: Direct API Polling  
In environments where the Language Server is inaccessible (e.g., remote SSH sessions or the Windsurf fork), the "sniffing" method fails. Here, the extension reverts to a standard client role.

* **Configuration:** The user must manually provide a GOOGLE\_API credential (likely a Refresh Token).  
* **Polling Loop:** The extension implements a setInterval loop that sends authenticated HTTP requests to the upstream quota endpoint (e.g., https://cloudaicompanion.googleapis.com/v1/users/me/quota).  
* **Payload Analysis:** The response JSON is parsed for fields like daily\_limit and remaining\_requests.

#### **4.1.2 Visualization Logic**

The data is rendered using the vscode.window.createStatusBarItem API.

* **Logic:** percentage \= (remaining / total) \* 100\.  
* **Visuals:** The extension dynamically updates the status bar color (Green \> 50%, Yellow \> 30%, Red \< 30%) providing immediate, peripheral feedback to the developer. This prevents the "surprise" of a sudden 429 error during a critical coding task.

## ---

**5\. Deep Analysis of Opencode Auth Plugins**

The third category represents the "Bridge" layer. These tools do not just manage accounts; they fundamentally alter the connectivity of the open-source Opencode CLI agent, allowing it to masquerade as a first-party Google client.

### **5.1 Repository: NoeFabris/opencode-antigravity-auth**

**Repository Overview:** This plugin enables the Opencode CLI to authenticate against Antigravity using Google credentials, granting access to models like claude-opus-4-5-thinking which are otherwise restricted to the IDE.8

#### **5.1.1 The Loopback OAuth Flow**

The authentication mechanism here is a textbook implementation of the **OAuth 2.0 Authorization Code Grant with PKCE** (Proof Key for Code Exchange), adapted for a CLI environment.

1. **Initiation:** The user executes opencode auth login. The plugin generates a distinct authorization URL.  
   * **Client ID Spoofing:** Crucially, the URL likely contains a specific client\_id extracted from the official Antigravity IDE. This ID tells Google "This request is coming from Antigravity," triggering the correct consent screen.  
   * **Redirect URI:** The URI is set to http://localhost:8080/callback (or a similar local ephemeral port).  
2. **The Listener:** The plugin spins up a temporary Node.js HTTP server on localhost:8080.  
3. **The Handshake:** When the user approves access in the browser, Google redirects to the localhost URL with a ?code=... parameter. The temporary server captures this code.  
4. **Token Exchange:** The plugin immediately shuts down the server and exchanges the authorization code for an access\_token and refresh\_token using the token endpoint.  
5. **Persistence:** These tokens are serialized into \~/.config/opencode/antigravity-accounts.json, creating a persistent identity on the machine.8

#### **5.1.2 Internal Scope Access**

The plugin requests scopes that are generally not available to public API consumers.

* **Scope:** https://www.googleapis.com/auth/cloudaicompanion.8  
* **Permission:** cloudaicompanion.companions.generateChat.  
* **Significance:** Possession of a token with these scopes allows the CLI to hit the internal cloudaicompanion.googleapis.com endpoints, which host the unmetered (or loosely metered) IDE quotas, rather than the billed Vertex AI endpoints.

#### **5.1.3 "Thinking" Block Stream Parsing**

A critical function of this plugin is translating the Gemini 3 output stream.

* **The Challenge:** The Opencode CLI expects a standard stream of text. Gemini 3 sends a mixed stream of "thought" objects and "text" objects.  
* **The Parser:** The plugin intercepts the Server-Sent Events (SSE). It identifies chunks tagged as thought. Instead of discarding them, it formats them—likely wrapping them in a collapsible Markdown block (e.g., \<details\>\<summary\>Thinking...\</summary\>...thought content...\</details\>) or a specific CLI UI element. This preserves the reasoning context for the user without corrupting the final code output.8

### **5.2 Repository: jenslys/opencode-gemini-auth**

**Repository Overview:** While similar in name, this plugin targets the *public* Gemini API (Gemini CLI) rather than the internal Antigravity endpoints.16

#### **5.2.1 Automated Cloud Provisioning**

A key differentiator is its handling of Google Cloud Projects (GCP).

* **The Friction:** Using the public Gemini API requires a GCP Project with the Generative Language API enabled. This is a high barrier for many developers.  
* **The Solution:** The plugin automates this. Upon login, it uses the Google Cloud Resource Manager API to list the user's projects. If no suitable project is found, it attempts to programmatically create one and enable the necessary APIs.  
* **Defaulting:** If creation fails (due to permissions), it falls back to a default project ID (ANTIGRAVITY\_DEFAULT\_PROJECT\_ID \- likely a hardcoded project ID associated with the generic CLI tool) or prompts the user. This "Auto-Provisioning" logic significantly lowers the onboarding friction.

## ---

**6\. Synthesis: The Engineering of Access (Comparative Analysis)**

The analysis of these five repositories reveals a coherent set of engineering patterns used to bypass the restrictions of the Antigravity platform.

| Feature | Antigravity-Manager | AntigravityQuotaWatcher | opencode-antigravity-auth |
| :---- | :---- | :---- | :---- |
| **Primary Goal** | High-volume Federation (Rotation) | Observability (Monitoring) | CLI Integration (Bridging) |
| **Auth Method** | Local Proxy (Axum) | LSP Sniffing / Polling | OAuth Loopback Server |
| **Target Endpoint** | Internal (cloudaicompanion) | Internal Language Server | Internal (cloudaicompanion) |
| **State Storage** | Encrypted Rust Keyring | VS Code Memento / Memory | JSON File (\~/.config/...) |
| **Innovation** | Dispatcher/Rotation Logic | Process/Port Scanning | Stream Transformation (Thinking) |

### **6.1 The "Bring Your Own Auth" (BYOA) Paradigm**

These tools collectively enforce a "Bring Your Own Auth" model. Unlike wrapper services that resell access (often violating ToS), these tools are technically "clients." The user provides the credentials; the tool simply manages the logistics of using them. This shifts the liability to the user while decentralizing the infrastructure costs—Google pays for the inference, and the user's local machine handles the orchestration.

### **6.2 The Security Implication of "Open" Plugins**

A critical risk identified in the opencode plugins is the storage of tokens. While Antigravity-Manager uses Rust-based encryption, the CLI plugins store refresh\_tokens in plain JSON files in the home directory.

* **Risk:** Any malicious script running on the user's machine (e.g., a compromised npm package) could read \~/.config/opencode/antigravity-accounts.json, exfiltrate the refresh tokens, and gain permanent access to the user's Google account and cloud resources.  
* **Mitigation:** Users replicating this should use filesystem permissions (chmod 600\) to restrict access to these configuration files.

## ---

**7\. Replication Guide: How to Engineer Your Own Antigravity Bridge**

This section addresses the practical aspect of the research request: "How could I do it myself?" The following is a rigorous engineering guide for a researcher aiming to replicate the functionality of Antigravity-Manager or Anti-API. This is not a script, but a theoretical framework for protocol reverse-engineering and client implementation.

### **7.1 Phase 1: Protocol Reverse Engineering**

Before writing code, one must map the terrain. The goal is to capture the exact HTTP requests sent by the official Antigravity/Windsurf IDE.

**Step 1: Traffic Interception Setup**

* **Tooling:** Install **mitmproxy** or **Fiddler Classic**.  
* **Certificate Pinning Bypass:** Modern IDEs may pin SSL certificates. To bypass this, you may need to launch the IDE with specific flags (e.g., \--ignore-certificate-errors) or inject the proxy's CA certificate into the IDE's trusted root store.  
* **Capture:** Launch the official IDE. Perform a specific action: "Login" and "Generate Code with Thinking."  
* **Observation:** Watch the proxy logs. Look for:  
  * **Auth Endpoint:** A request to accounts.google.com/o/oauth2/auth. Note the client\_id and scope parameters.  
  * **API Endpoint:** A POST request to https://cloudaicompanion.googleapis.com/... or similar.

**Step 2: Payload Forensic Analysis**

* **Headers:** Inspect the Authorization header. Decode the JWT (if it is one) to see the claims. Look for custom headers like x-goog-api-client or x-goog-user-project—these are often required for the request to succeed.  
* **Body Structure:** Analyze the JSON body.  
  * How is the prompt structured? Is it {"prompt": "text"} or {"messages": \[{"role": "user", "content": "text"}\]}?  
  * Identify the configuration parameters for "Thinking" (thinking\_config, thinking\_budget).  
* **Response Stream:** Analyze the SSE stream. You will see lines starting with data:. Decode the base64 payloads to differentiate between "Thought" chunks and "Content" chunks.

### **7.2 Phase 2: Implementing the OAuth Client**

You cannot generate valid tokens without Google's authorization server. You must build a client that mimics the IDE.

**Step 1: Client ID Extraction**

* From your proxy logs in Phase 1, copy the client\_id string. This is a public identifier, but using the specific one from the IDE ensures you get the correct scopes.  
* **Scopes:** Note the scopes requested (e.g., openid, email, https://www.googleapis.com/auth/cloudaicompanion).

**Step 2: The Loopback Authenticator**

* Write a script (Python/Rust/Node) that opens a socket on localhost:8080.  
* Construct the auth URL:  
  https://accounts.google.com/o/oauth2/v2/auth?client\_id=\&redirect\_uri=http://localhost:8080/callback\&response\_type=code\&scope=\&access\_type=offline  
* **Crucial:** The access\_type=offline parameter is mandatory. Without it, you will not receive a refresh\_token, and your tool will stop working after 1 hour.  
* Open this URL in the system browser. When the redirect hits your local socket, extract the code and POST it to https://oauth2.googleapis.com/token to get your credentials.

### **7.3 Phase 3: Building the "Request Mapper" Proxy**

To make this useful, you want to use it with standard tools (like Cursor or a generic Chat UI). You need a translation layer.

**Step 1: The Gateway Server**

* Create a local HTTP server (using Python FastAPI or Rust Axum) listening on port 3000\.  
* Implement a route POST /v1/chat/completions that matches the OpenAI API spec.

**Step 2: Request Translation Logic**

* **Input:** Receive the OpenAI-formatted JSON.  
* **Transform:** Map messages to the Antigravity content structure.  
  * OpenAI: {"role": "user", "content": "Hello"}  
  * Antigravity: {"role": "user", "parts": \[{"text": "Hello"}\]}  
* **Config Injection:** Inject the thinkingLevel: "high" parameter into the Antigravity payload if the user requested it (perhaps mapped from a high temperature setting).

**Step 3: Response Streaming & Thought Parsing**

* Send the transformed request to Google using your stored Access Token.  
* **Stream Processing:** As chunks arrive from Google:  
  1. Decode the chunk.  
  2. Check if it is a "Thought" or "Content".  
  3. **Thought Handling:** If it's a thought, you have a choice:  
     * *Hide it:* Discard the chunk (cleaner output).  
     * *Show it:* Wrap it in a special tag (e.g., ...) and send it as standard content delta.  
  4. **Re-encoding:** Wrap the text in the OpenAI SSE format: data: {"choices": \[{"delta": {"content": "..."}}\]}.  
  5. Flush to the client.

### **7.4 Phase 4: Implementing Account Rotation (The Manager Logic)**

To replicate the "Manager," you need a pool of tokens.

**Step 1: The Token Pool**

* Create a storage mechanism (JSON/SQLite) that holds a list of refresh\_tokens.

**Step 2: The Dispatcher Algorithm**

* Implement a function get\_active\_session():  
  * Iterate through the pool.  
  * Check if the account is in a "Cooldown" state (based on a timestamp you set when a 429 occurs).  
  * If valid, use its refresh\_token to get a fresh access\_token.

**Step 3: The Circuit Breaker**

* Wrap your upstream request to Google in a try/catch block.  
* **If 429 (Rate Limit) occurs:**  
  1. Log the error.  
  2. Mark the current account ID as "Cooldown" (e.g., for 1 hour).  
  3. **Recursion:** Immediately call get\_active\_session() again to get the *next* account.  
  4. Retry the request.  
* This logic ensures that your local proxy server absorbs the error, providing uninterrupted service to the frontend client.

## **8\. Conclusion**

The ecosystem surrounding the Antigravity platform represents a sophisticated instance of user-driven interoperability. Through the repositories Antigravity-Manager, AntigravityQuotaWatcher, and the opencode authentication plugins, developers have effectively reverse-engineered a proprietary, rate-limited IDE environment into a flexible, high-availability API service.

The mechanisms employed—specifically **OAuth loopback interception**, **LSP port sniffing**, **Webview token extraction**, and **multi-account rotation algorithms**—demonstrate a high degree of technical ingenuity. They bridge the gap between closed, internal APIs (cloudaicompanion) and open standards (OpenAI/LSP), allowing for the "Quota Arbitrage" that drives the utility of these tools.

For researchers and engineers, replicating this architecture requires a mastery of network protocol analysis and secure credential management. It involves building a "Man-in-the-Middle" translation layer that can speak the dialect of the proprietary service while presenting a standard face to the user. While highly effective, this architecture relies entirely on the continued stability of the internal endpoints and the generosity of the existing quota policies, rendering it a powerful but inherently fragile solution in the evolving landscape of AI development tools.

#### **Obras citadas**

1. Tried Google's Anti-Gravity yesterday — and honestly, I'm impressed. : r/vibecoding \- Reddit, fecha de acceso: enero 13, 2026, [https://www.reddit.com/r/vibecoding/comments/1p0wu5q/tried\_googles\_antigravity\_yesterday\_and\_honestly/](https://www.reddit.com/r/vibecoding/comments/1p0wu5q/tried_googles_antigravity_yesterday_and_honestly/)  
2. Gemini 3 Flash: Google's Fastest Frontier AI Model for Developers and Enterprises \- Apidog, fecha de acceso: enero 13, 2026, [https://apidog.com/blog/gemini-3-flash/](https://apidog.com/blog/gemini-3-flash/)  
3. Google AI Pro and Ultra subscribers now have higher rate limits for Google Antigravity., fecha de acceso: enero 13, 2026, [https://blog.google/feed/new-antigravity-rate-limits-pro-ultra-subsribers/](https://blog.google/feed/new-antigravity-rate-limits-pro-ultra-subsribers/)  
4. Google Antigravity (Public Preview): What It Is, How It Works, and What the Limits Really Mean \- DEV Community, fecha de acceso: enero 13, 2026, [https://dev.to/blamsa0mine/google-antigravity-public-preview-what-it-is-how-it-works-and-what-the-limits-really-mean-4pe](https://dev.to/blamsa0mine/google-antigravity-public-preview-what-it-is-how-it-works-and-what-the-limits-really-mean-4pe)  
5. Gemini thinking | Gemini API | Google AI for Developers, fecha de acceso: enero 13, 2026, [https://ai.google.dev/gemini-api/docs/thinking](https://ai.google.dev/gemini-api/docs/thinking)  
6. Gemini 3 Developer Guide | Gemini API \- Google AI for Developers, fecha de acceso: enero 13, 2026, [https://ai.google.dev/gemini-api/docs/gemini-3](https://ai.google.dev/gemini-api/docs/gemini-3)  
7. Get\_started\_thinking\_REST.ipynb \- Google Colab, fecha de acceso: enero 13, 2026, [https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Get\_started\_thinking\_REST.ipynb](https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Get_started_thinking_REST.ipynb)  
8. NoeFabris/opencode-antigravity-auth: Enable Opencode to ... \- GitHub, fecha de acceso: enero 13, 2026, [https://github.com/NoeFabris/opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth)  
9. Build with Google Antigravity, our new agentic development platform, fecha de acceso: enero 13, 2026, [https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/)  
10. lbjlaq/Antigravity-Manager: Professional Antigravity ... \- GitHub, fecha de acceso: enero 13, 2026, [https://github.com/lbjlaq/Antigravity-Manager](https://github.com/lbjlaq/Antigravity-Manager)  
11. Antigravity-Manager/README\_EN.md at main \- GitHub, fecha de acceso: enero 13, 2026, [https://github.com/lbjlaq/Antigravity-Manager/blob/main/README\_EN.md](https://github.com/lbjlaq/Antigravity-Manager/blob/main/README_EN.md)  
12. Soriya75/Antigravity-Manager: Manage accounts seamlessly while accessing AI tools like Gemini and Claude, breaking API call limits with ease. \- GitHub, fecha de acceso: enero 13, 2026, [https://github.com/Soriya75/Antigravity-Manager](https://github.com/Soriya75/Antigravity-Manager)  
13. fecha de acceso: enero 1, 1970, [https://github.com/lbjlaq/Antigravity-Manager/tree/main/src-tauri](https://github.com/lbjlaq/Antigravity-Manager/tree/main/src-tauri)  
14. GitHub \- MonchiLin/antigravity-agent, fecha de acceso: enero 13, 2026, [https://github.com/MonchiLin/antigravity-agent](https://github.com/MonchiLin/antigravity-agent)  
15. wusimpl/AntigravityQuotaWatcher: Google Antigravity AI ... \- GitHub, fecha de acceso: enero 13, 2026, [https://github.com/wusimpl/AntigravityQuotaWatcher](https://github.com/wusimpl/AntigravityQuotaWatcher)  
16. jenslys/opencode-gemini-auth: Gemini auth plugin for ... \- GitHub, fecha de acceso: enero 13, 2026, [https://github.com/jenslys/opencode-gemini-auth](https://github.com/jenslys/opencode-gemini-auth)