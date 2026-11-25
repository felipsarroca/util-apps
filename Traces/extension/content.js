const i="traces-gdocs-toolbar-btn",o="traces-gdocs-drawer-root",b="traces-gdocs-injected-styles",l="traces_drawer_width_v1";let s=480,c=!1;function f(){return!(!/\/document\/(?:u\/\d+\/)?d\/[a-zA-Z0-9_-]+/.test(location.pathname)||window.innerWidth<300||window.innerHeight<200)}function x(){if(document.getElementById(b))return;const e=document.createElement("style");e.id=b,e.textContent=`
    #${i} {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 34px;
      padding: 0 13px 0 10px;
      margin-right: 8px;
      border-radius: 999px;
      border: 1px solid #bae6fd;
      background: #f0f9ff;
      color: #0f172a;
      font-family: 'Google Sans', Roboto, system-ui, sans-serif;
      font-size: 13.5px;
      font-weight: 600;
      line-height: 1;
      cursor: pointer;
      user-select: none;
      vertical-align: middle;
      transition: background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
      z-index: 999;
    }
    #${i}:hover {
      background: #e0f2fe;
      border-color: #7dd3fc;
    }
    #${i}.traces-btn-active {
      background: #1e293b;
      border-color: #1e293b;
      color: #ffffff;
    }
    #${i}.traces-btn-floating {
      position: fixed;
      top: 12px;
      right: 16px;
      z-index: 2147483645;
    }
    #${i} .traces-btn-badge {
      width: 20px;
      height: 20px;
      display: block;
      flex-shrink: 0;
    }
    #${o} {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 480px;
      max-width: 92vw;
      background: #f4f6fb;
      border-left: 1px solid #cbd5e1;
      box-shadow: -10px 0 28px rgba(15, 23, 42, 0.14);
      z-index: 2147483646;
      display: none;
      flex-direction: column;
    }
    #${o}.traces-drawer-open {
      display: flex;
    }
    #${o} .traces-resize-handle {
      position: absolute;
      top: 0;
      left: -4px;
      bottom: 0;
      width: 8px;
      cursor: ew-resize;
      z-index: 2;
    }
    #${o} .traces-resize-handle::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 3px;
      transform: translateY(-50%);
      width: 2px;
      height: 36px;
      border-radius: 2px;
      background: #94a3b8;
      opacity: 0;
      transition: opacity 0.15s;
    }
    #${o} .traces-resize-handle:hover::after {
      opacity: 0.85;
    }
    #${o} iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #f4f6fb;
      display: block;
    }
  `,(document.head||document.documentElement).appendChild(e)}function T(){var e;try{typeof chrome<"u"&&((e=chrome.storage)!=null&&e.local)&&chrome.storage.local.get(l,t=>{const n=Number(t==null?void 0:t[l]);if(Number.isFinite(n)&&n>=360&&n<=780){s=n;const a=document.getElementById(o);a&&(a.style.width=`${s}px`)}})}catch{}}function g(e){var t;try{typeof chrome<"u"&&((t=chrome.storage)!=null&&t.local)&&chrome.storage.local.set({[l]:Math.round(e)})}catch{}}function v(){let e=document.getElementById(o);if(e)return e;e=document.createElement("aside"),e.id=o,e.setAttribute("aria-label","Panell lateral de Traces"),e.style.width=`${s}px`;const t=document.createElement("div");t.className="traces-resize-handle",t.title="Arrossega per ajustar l’amplada del panell";const n=document.createElement("iframe");n.src=chrome.runtime.getURL("sidepanel.html?embedded=1"),n.allow="clipboard-write";let a=!1;return t.addEventListener("mousedown",d=>{d.preventDefault(),a=!0,n.style.pointerEvents="none";const r=y=>{if(!a||!e)return;const p=Math.max(360,Math.min(780,window.innerWidth-y.clientX));s=p,e.style.width=`${p}px`},m=()=>{a=!1,n.style.pointerEvents="",g(s),window.removeEventListener("mousemove",r),window.removeEventListener("mouseup",m)};window.addEventListener("mousemove",r),window.addEventListener("mouseup",m)}),e.appendChild(t),e.appendChild(n),document.body.appendChild(e),e}function w(e){var d;const t=document.getElementById(i);if(!e){const r=document.getElementById(o);r&&r.classList.remove("traces-drawer-open"),t&&t.classList.remove("traces-btn-active");return}const n=v(),a=!n.classList.contains("traces-drawer-open");if(n.classList.add("traces-drawer-open"),t&&t.classList.add("traces-btn-active"),a){const r=n.querySelector("iframe");(d=r==null?void 0:r.contentWindow)==null||d.postMessage({type:"TRACES_REFRESH_REQUEST"},"*")}}function E(){const e=document.getElementById(o),t=!!(e!=null&&e.classList.contains("traces-drawer-open"));w(!t)}function I(){const e=document.createElement("button");e.type="button",e.id=i,e.title="Analitza l’historial d’elaboració amb Traces";const t=chrome.runtime.getURL("icons/icon32.png");return e.innerHTML=`
    <img class="traces-btn-badge" src="${t}" width="20" height="20" alt="" aria-hidden="true" />
    <span>Traces</span>
  `,e.addEventListener("click",n=>{n.stopPropagation(),E()}),e}function u(){var n;if(!f()||document.getElementById(i))return;x(),T();const e=I(),t=document.querySelector(".docs-titlebar-buttons")||((n=document.getElementById("docs-titlebar-share-client-button"))==null?void 0:n.parentElement);t?t.insertBefore(e,t.firstChild):document.body&&(e.classList.add("traces-btn-floating"),document.body.appendChild(e))}window.addEventListener("message",e=>{const t=e.data;if(!(!t||typeof t!="object")){if(t.type==="TRACES_CLOSE_DRAWER")w(!1);else if(t.type==="TRACES_TOGGLE_WIDTH"){const n=document.getElementById(o);if(!n)return;c=!c,s=c?660:480,n.style.width=`${s}px`,g(s)}}});var h;typeof chrome<"u"&&((h=chrome.runtime)!=null&&h.onMessage)&&chrome.runtime.onMessage.addListener((e,t,n)=>(e==null?void 0:e.type)==="TRACES_TOGGLE_IN_PAGE_DRAWER"&&f()?(u(),E(),n({handled:!0}),!0):!1);function _(){if(!f())return;u();const e=new MutationObserver(()=>{const t=document.getElementById(i);if(!t)u();else if(t.classList.contains("traces-btn-floating")){const n=document.querySelector(".docs-titlebar-buttons");n&&(t.classList.remove("traces-btn-floating"),n.insertBefore(t,n.firstChild))}});document.body&&e.observe(document.body,{childList:!0,subtree:!0})}_();
