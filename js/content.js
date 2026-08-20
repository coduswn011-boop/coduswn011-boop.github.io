/* ================================================================
   NOBEL GYM 24 — 사이트 인라인 편집기
   ▸ 어드민 비밀번호로 로그인한 관리자만 편집 바가 보입니다.
   ▸ 문구: [data-ek="키"]  /  사진: [data-img="키"]
   ▸ 저장은 Netlify Function → Apps Script → 구글 시트/드라이브
   ================================================================ */
(function () {
  "use strict";

  var CFG = window.NOBEL_CONFIG || {};
  var STORE = window.NobelStore;
  var EDITOR_KEY = "nobelgym.editor";

  var content = {};       // 서버에서 받은 오버라이드
  var original = {};      // 원래 문구 (되돌리기용)
  var editing = false;
  var dirty = {};         // 저장 대기 중인 변경분

  /* ================================================================
     오버라이드 적용
     ================================================================ */
  function applyText(el) {
    var k = el.getAttribute("data-ek");
    if (!k) return;
    if (!(k in original)) original[k] = el.innerHTML;

    var v = content[k];
    var want = (v == null || v === "") ? original[k] : v;
    if (el.innerHTML !== want) el.innerHTML = want;
  }

  function applyImage(el) {
    var k = el.getAttribute("data-img");
    if (!k) return;
    var url = content[k];

    if (k === "brand.logo") {
      if (url) {
        if (!el.querySelector("img")) el.innerHTML = "";
        var img = el.querySelector("img") || el.appendChild(document.createElement("img"));
        if (img.getAttribute("src") !== url) img.src = url;
        img.alt = "노벨짐";
        el.classList.add("has-logo");
      } else {
        el.classList.remove("has-logo");
        if (el.querySelector("img")) el.innerHTML = "N";
      }
      return;
    }

    // 배경 그라데이션을 덮지 않도록 CSS 변수로 전달합니다
    if (url) {
      el.style.setProperty("--photo", "url('" + url.replace(/'/g, "%27") + "')");
      el.classList.add("has-photo");
    } else {
      el.style.removeProperty("--photo");
      el.classList.remove("has-photo");
    }
  }

  var applyTimer;
  function applyAll() {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(function () {
      document.querySelectorAll("[data-ek]").forEach(applyText);
      document.querySelectorAll("[data-img]").forEach(applyImage);
      if (editing) markEditable();
    }, 30);
  }

  /* ================================================================
     편집 바
     ================================================================ */
  function currentPass() {
    try { return localStorage.getItem(EDITOR_KEY) || ""; } catch (e) { return ""; }
  }

  function buildBar() {
    var bar = document.createElement("div");
    bar.id = "edBar";
    bar.innerHTML =
      '<span class="ed-brand">관리자</span>' +
      '<button type="button" id="edToggle" class="ed-main">✏️ 편집 모드</button>' +
      '<button type="button" id="edSave" hidden>저장</button>' +
      '<button type="button" id="edCancel" hidden>취소</button>' +
      '<button type="button" id="edReset" hidden class="ed-ghost">전체 되돌리기</button>' +
      '<a href="/admin/" class="ed-ghost">어드민</a>' +
      '<button type="button" id="edOut" class="ed-ghost">로그아웃</button>' +
      '<span class="ed-status" id="edStatus"></span>';
    document.body.appendChild(bar);
    document.body.classList.add("has-edbar");

    document.getElementById("edToggle").addEventListener("click", function () {
      editing ? stopEditing(true) : startEditing();
    });
    document.getElementById("edSave").addEventListener("click", save);
    document.getElementById("edCancel").addEventListener("click", function () { stopEditing(true); });
    document.getElementById("edReset").addEventListener("click", resetAll);
    document.getElementById("edOut").addEventListener("click", function () {
      try { localStorage.removeItem(EDITOR_KEY); } catch (e) {}
      location.reload();
    });
  }

  function status(msg, tone) {
    var el = document.getElementById("edStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "ed-status" + (tone ? " " + tone : "");
  }

  /* ================================================================
     편집 시작 / 종료
     ================================================================ */
  function markEditable() {
    document.querySelectorAll("[data-ek]").forEach(function (el) {
      el.setAttribute("contenteditable", "true");
      el.classList.add("ed-on");
      if (!el.__edBound) {
        el.__edBound = true;
        el.addEventListener("input", function () {
          var k = el.getAttribute("data-ek");
          var html = el.innerHTML.trim();
          dirty[k] = (html === original[k] || html === "") ? "" : html;
          status("수정됨 · 저장 눌러주세요", "warn");
        });
        el.addEventListener("paste", function (e) {
          e.preventDefault();
          var t = (e.clipboardData || window.clipboardData).getData("text/plain");
          document.execCommand("insertText", false, t);
        });
        el.addEventListener("keydown", function (e) {
          if (e.key === "Enter" && !e.shiftKey && el.tagName !== "P" && el.tagName !== "DIV") e.preventDefault();
        });
      }
    });
    document.querySelectorAll("[data-img]").forEach(addPhotoTools);
  }

  function unmarkEditable() {
    document.querySelectorAll("[data-ek]").forEach(function (el) {
      el.removeAttribute("contenteditable");
      el.classList.remove("ed-on");
    });
    document.querySelectorAll("[data-img]").forEach(function (el) {
      el.classList.remove("ed-img-on");
      var w = el.querySelector(":scope > .ed-file-wrap");
      if (w) w.remove();
      var d = el.querySelector(":scope > .ed-file-del");
      if (d) d.remove();
    });
  }

  /** 사진 슬롯 위에 "올리기" 라벨(진짜 file input) 과 "지우기" 버튼을 붙입니다.
      label 안의 진짜 input 을 쓰기 때문에 브라우저 파일 선택창이 확실히 열립니다. */
  function addPhotoTools(el) {
    el.classList.add("ed-img-on");
    var key = el.getAttribute("data-img");
    var label = el.getAttribute("data-label") || "사진";

    var wrap = el.querySelector(":scope > .ed-file-wrap");
    if (!wrap) {
      wrap = document.createElement("label");
      wrap.className = "ed-file-wrap";
      wrap.innerHTML = '<input type="file" accept="image/*"><span></span>';
      wrap.addEventListener("click", function (e) { e.stopPropagation(); });
      wrap.querySelector("input").addEventListener("change", function (e) {
        var f = e.target.files && e.target.files[0];
        e.target.value = "";
        if (f) handleFile(f, el, key);
      });
      el.appendChild(wrap);
    }
    wrap.querySelector("span").textContent =
      "📷 " + label + (content[key] ? " 바꾸기" : " 올리기");

    var del = el.querySelector(":scope > .ed-file-del");
    if (content[key]) {
      if (!del) {
        del = document.createElement("button");
        del.type = "button";
        del.className = "ed-file-del";
        del.textContent = "✕";
        del.title = "사진 지우기";
        del.addEventListener("click", function (e) {
          e.preventDefault(); e.stopPropagation();
          dirty[key] = "";
          delete content[key];
          applyImage(el);
          addPhotoTools(el);
          status("사진 지움 · 저장 눌러주세요", "warn");
        });
        el.appendChild(del);
      }
    } else if (del) {
      del.remove();
    }
  }

  function blockClicks(e) {
    if (!editing) return;
    if (e.target.closest("#edBar")) return;
    if (e.target.closest("[data-img]")) return;          // 사진 업로드는 허용
    if (e.target.closest("[contenteditable=true]")) return; // 커서 놓기 허용
    e.preventDefault();
    e.stopPropagation();
  }

  function startEditing() {
    editing = true;
    dirty = {};
    markEditable();
    document.body.classList.add("ed-editing");
    document.getElementById("edToggle").textContent = "✅ 편집 끝내기";
    ["edSave", "edCancel", "edReset"].forEach(function (id) { document.getElementById(id).hidden = false; });
    status("문구를 클릭해 바로 고치고, 사진 자리를 눌러 올리세요");
    document.addEventListener("click", blockClicks, true);
  }

  function stopEditing(discard) {
    if (discard && Object.keys(dirty).length &&
        !confirm("저장하지 않은 변경사항이 있습니다. 버릴까요?")) return;
    editing = false;
    dirty = {};
    unmarkEditable();
    document.body.classList.remove("ed-editing");
    document.getElementById("edToggle").textContent = "✏️ 편집 모드";
    ["edSave", "edCancel", "edReset"].forEach(function (id) { document.getElementById(id).hidden = true; });
    status("");
    document.removeEventListener("click", blockClicks, true);
    applyAll();
  }

  /* ================================================================
     저장 / 되돌리기
     ================================================================ */
  function save() {
    var items = dirty;
    if (!Object.keys(items).length) { status("바뀐 내용이 없습니다"); return; }

    var btn = document.getElementById("edSave");
    btn.disabled = true;
    status("저장 중…");

    STORE.saveContent(items).then(function () {
      Object.keys(items).forEach(function (k) {
        if (items[k] === "") delete content[k]; else content[k] = items[k];
      });
      dirty = {};
      btn.disabled = false;
      status("저장 완료 · 모든 방문자에게 반영됐습니다", "ok");
      setTimeout(function () { if (!Object.keys(dirty).length) status(""); }, 4000);
    }).catch(function (err) {
      btn.disabled = false;
      status("저장 실패: " + (err.message || err), "err");
    });
  }

  function resetAll() {
    if (!confirm("직접 수정한 문구와 사진을 모두 지우고 처음 상태로 되돌립니다. 계속할까요?")) return;
    var items = {};
    Object.keys(content).forEach(function (k) { items[k] = ""; });
    if (!Object.keys(items).length) { status("되돌릴 항목이 없습니다"); return; }

    status("되돌리는 중…");
    STORE.saveContent(items).then(function () {
      content = {};
      dirty = {};
      applyAll();
      status("처음 상태로 되돌렸습니다", "ok");
    }).catch(function (err) {
      status("실패: " + (err.message || err), "err");
    });
  }

  /* ================================================================
     사진 업로드
     ================================================================ */
  function handleFile(file, el, key) {
    status("사진 준비 중…");
    resize(file, 1600, 0.85).then(function (dataUrl) {
      status("업로드 중…");
      return STORE.uploadImage(dataUrl, key.replace(/\./g, "-"));
    }).then(function (res) {
      content[key] = res.url;
      dirty[key] = res.url;
      applyImage(el);
      addPhotoTools(el);
      status("사진 올림 · 저장 눌러주세요", "warn");
    }).catch(function (err) {
      status("업로드 실패: " + (err.message || err), "err");
    });
  }

  /** 브라우저에서 미리 줄여서 올립니다 (업로드 속도 · 용량 절약) */
  function resize(file, maxW, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("파일을 읽지 못했습니다")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("이미지 형식이 아닙니다")); };
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
          var c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/jpeg", quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ================================================================
     시작
     ================================================================ */
  function init() {
    // 재렌더(직무 탭 전환 등) 후에도 오버라이드 유지
    var mo = new MutationObserver(function () { applyAll(); });
    mo.observe(document.body, { childList: true, subtree: true });

    STORE.refreshContent().then(function (c) {
      content = c || {};
      applyAll();
    }).catch(function (err) {
      console.warn("콘텐츠 조회 실패 — 기본 문구로 표시합니다.", err);
    });

    if (currentPass()) {
      STORE.setAdminPass(currentPass());
      buildBar();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
