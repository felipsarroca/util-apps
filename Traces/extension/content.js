const s="traces-gdocs-toolbar-btn",r="traces-gdocs-drawer-root",g="traces-gdocs-injected-styles",f="traces-gdocs-push-styles",m="traces_drawer_width_v1",E="traces_settings_v1";let a=480,u=!1,l=!0;function h(){return!(!/\/(?:document|presentation|spreadsheets)\/(?:u\/\d+\/)?d\/[a-zA-Z0-9_-]+/.test(location.pathname)||window.innerWidth<300||window.innerHeight<200)}function D(){if(document.getElementById(g))return;const e=document.createElement("style");e.id=g,e.textContent=`
    #${s} {
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
    #${s}:hover {
      background: #e0f2fe;
      border-color: #7dd3fc;
    }
    #${s}.traces-btn-active {
      background: #1e293b;
      border-color: #1e293b;
      color: #ffffff;
    }
    #${s}.traces-btn-floating {
      position: fixed;
      bottom: 18px;
      right: 18px;
      z-index: 2147483645;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.18);
    }
    #${s} .traces-btn-badge {
      width: 20px;
      height: 20px;
      display: block;
      flex-shrink: 0;
    }
    #${r} {
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
    #${r}.traces-drawer-open {
      display: flex;
    }
    #${r} .traces-resize-handle {
      position: absolute;
      top: 0;
      left: -4px;
      bottom: 0;
      width: 8px;
      cursor: ew-resize;
      z-index: 2;
    }
    #${r} .traces-resize-handle::after {
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
    #${r} .traces-resize-handle:hover::after {
      opacity: 0.85;
    }
    #${r} iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #f4f6fb;
      display: block;
    }
  `,(document.head||document.documentElement).appendChild(e)}function W(){var e;try{typeof chrome<"u"&&((e=chrome.storage)!=null&&e.local)&&chrome.storage.local.get(m,t=>{const n=Number(t==null?void 0:t[m]);if(Number.isFinite(n)&&n>=360&&n<=780){a=n;const o=document.getElementById(r);o&&(o.style.width=`${a}px`)}})}catch{}}function x(e){var t;try{typeof chrome<"u"&&((t=chrome.storage)!=null&&t.local)&&chrome.storage.local.set({[m]:Math.round(e)})}catch{}}function L(){var e,t;try{(t=(e=chrome.storage)==null?void 0:e.local)==null||t.get(E,n=>{var d;const o=(d=n==null?void 0:n[E])==null?void 0:d.pushDocument;typeof o=="boolean"&&(l=o)})}catch{}}function c(e){let t=document.getElementById(f);if(!(e&&l&&window.innerWidth>=1e3)){t&&(t.remove(),window.dispatchEvent(new Event("resize")));return}t||(t=document.createElement("style"),t.id=f,(document.head||document.documentElement).appendChild(t)),t.textContent=`html { width: calc(100% - ${Math.round(a)}px) !important; overflow-x: hidden !important; }`,window.dispatchEvent(new Event("resize"))}function _(){var e;return!!((e=document.getElementById(r))!=null&&e.classList.contains("traces-drawer-open"))}function S(){let e=document.getElementById(r);if(e)return e;e=document.createElement("aside"),e.id=r,e.setAttribute("aria-label","Panell lateral de Traces"),e.style.width=`${a}px`;const t=document.createElement("div");t.className="traces-resize-handle",t.title="Arrossega per ajustar l’amplada del panell";const n=document.createElement("iframe");n.src=chrome.runtime.getURL("sidepanel.html?embedded=1"),n.allow="clipboard-write";let o=!1;return t.addEventListener("mousedown",d=>{d.preventDefault(),o=!0,n.style.pointerEvents="none";const i=T=>{if(!o||!e)return;const w=Math.max(360,Math.min(780,window.innerWidth-T.clientX));a=w,e.style.width=`${w}px`,c(!0)},b=()=>{o=!1,n.style.pointerEvents="",x(a),window.removeEventListener("mousemove",i),window.removeEventListener("mouseup",b)};window.addEventListener("mousemove",i),window.addEventListener("mouseup",b)}),e.appendChild(t),e.appendChild(n),document.body.appendChild(e),e}function I(e){var d;const t=document.getElementById(s);if(!e){const i=document.getElementById(r);i&&i.classList.remove("traces-drawer-open"),t&&t.classList.remove("traces-btn-active"),c(!1);return}const n=S(),o=!n.classList.contains("traces-drawer-open");if(n.classList.add("traces-drawer-open"),t&&t.classList.add("traces-btn-active"),c(!0),o){const i=n.querySelector("iframe");(d=i==null?void 0:i.contentWindow)==null||d.postMessage({type:"TRACES_REFRESH_REQUEST"},"*")}}function v(){const e=document.getElementById(r),t=!!(e!=null&&e.classList.contains("traces-drawer-open"));I(!t)}function R(){const e=document.createElement("button");e.type="button",e.id=s,e.title="Analitza com s’ha elaborat aquest fitxer amb Traces";const t=chrome.runtime.getURL("icons/icon32.png");return e.innerHTML=`
    <img class="traces-btn-badge" src="${t}" width="20" height="20" alt="" aria-hidden="true" />
    <span>Traces</span>
  `,e.addEventListener("click",n=>{n.stopPropagation(),v()}),e}function p(){var n;if(!h()||document.getElementById(s))return;D(),W(),L();const e=R(),t=document.querySelector(".docs-titlebar-buttons")||((n=document.getElementById("docs-titlebar-share-client-button"))==null?void 0:n.parentElement);t?t.insertBefore(e,t.firstChild):document.body&&(e.classList.add("traces-btn-floating"),document.body.appendChild(e))}window.addEventListener("message",e=>{const t=e.data;if(!t||typeof t!="object")return;const n=document.querySelector(`#${r} iframe`);if(!(!n||e.source!==n.contentWindow))if(t.type==="TRACES_CLOSE_DRAWER")I(!1);else if(t.type==="TRACES_TOGGLE_WIDTH"){const o=document.getElementById(r);if(!o)return;u=!u,a=u?660:480,o.style.width=`${a}px`,x(a),c(!0)}else t.type==="TRACES_SET_PUSH"&&(l=!!t.value,c(_()))});window.addEventListener("resize",()=>{if(!_())return;(l&&window.innerWidth>=1e3)!==!!document.getElementById(f)&&c(!0)});var y;typeof chrome<"u"&&((y=chrome.runtime)!=null&&y.onMessage)&&chrome.runtime.onMessage.addListener((e,t,n)=>(e==null?void 0:e.type)==="TRACES_TOGGLE_IN_PAGE_DRAWER"&&h()?(p(),v(),n({handled:!0}),!0):!1);function A(){if(!h())return;p();const e=new MutationObserver(()=>{const t=document.getElementById(s);if(!t)p();else if(t.classList.contains("traces-btn-floating")){const n=document.querySelector(".docs-titlebar-buttons");n&&(t.classList.remove("traces-btn-floating"),n.insertBefore(t,n.firstChild))}});document.body&&e.observe(document.body,{childList:!0,subtree:!0})}A();
