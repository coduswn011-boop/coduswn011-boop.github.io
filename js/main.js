/* ================================================================
   NOBEL GYM 24 — 채용 사이트 스크립트
   ================================================================ */
(function () {
  "use strict";

  var CFG = window.NOBEL_CONFIG || {};
  var STORE = window.NobelStore;

  /* ---------- 유틸 ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function dday(deadline) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var end = new Date(deadline + "T00:00:00");
    return Math.round((end - today) / 86400000);
  }
  function fmtDate(d) { return String(d || "").replace(/-/g, "."); }

  /* ---------- 브랜드 값 바인딩 ---------- */
  (function bindBrand() {
    var kakao = BRAND.kakaoUrl;
    ["floatKakao", "kakaoLink"].forEach(function (id) {
      var el = $(id); if (el) el.href = kakao;
    });
    var tel = $("telLink");
    if (tel) { tel.textContent = BRAND.tel; tel.href = "tel:" + BRAND.tel.replace(/-/g, ""); }
    var fe = $("footEmail"); if (fe) fe.textContent = BRAND.applyEmail;
    var sb = $("statBranch"); if (sb) sb.textContent = BRANCHES.length;
  })();

  /* ---------- 모바일 내비 ---------- */
  var navToggle = $("navToggle"), gnb = $("gnb");
  navToggle.addEventListener("click", function () {
    var open = gnb.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  gnb.addEventListener("click", function (e) {
    if (e.target.tagName === "A") {
      gnb.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });

  /* ---------- 인재상 ---------- */
  $("valueGrid").innerHTML = VALUES.map(function (v, i) {
    return '<article class="value"><span class="no" data-ek="values.' + i + '.no">' + esc(v.no) + "</span>" +
      '<h3 data-ek="values.' + i + '.title">' + esc(v.title) + "</h3>" +
      '<p data-ek="values.' + i + '.desc">' + esc(v.desc) + "</p></article>";
  }).join("");

  /* ---------- 보상 테이블 ---------- */
  $("payBody").innerHTML = PAY_TIERS.map(function (t, i) {
    var k = "pay.tier." + i + ".";
    return "<tr><td class='tier' data-ek='" + k + "tier'>" + esc(t.tier) +
      "</td><td data-ek='" + k + "range'>" + esc(t.range) +
      "</td><td class='rate' data-ek='" + k + "rate'>" + esc(t.rate) +
      "</td><td class='bonus' data-ek='" + k + "bonus'>" + esc(t.bonus || "—") +
      "</td><td data-ek='" + k + "note'>" + esc(t.note) + "</td></tr>";
  }).join("");

  /* ---------- 복리후생 ---------- */
  $("benefitGrid").innerHTML = BENEFITS.map(function (b, i) {
    return '<article class="benefit"><span class="dot"></span>' +
      '<b data-ek="benefits.' + i + '.title">' + esc(b.title) + "</b>" +
      '<p data-ek="benefits.' + i + '.desc">' + esc(b.desc) + "</p></article>";
  }).join("");

  /* ---------- 채용 절차 ---------- */
  $("processList").innerHTML = PROCESS.map(function (p, i) {
    var k = "process." + i + ".";
    return '<article class="process-item"><span class="step" data-ek="' + k + 'step">' + esc(p.step) + "</span>" +
      '<h3 data-ek="' + k + 'title">' + esc(p.title) + "</h3>" +
      '<p data-ek="' + k + 'desc">' + esc(p.desc) + "</p>" +
      '<span class="sla" data-ek="' + k + 'sla">' + esc(p.sla) + "</span></article>";
  }).join("");

  /* ---------- 지점 ---------- */
  $("branchGrid").innerHTML = BRANCHES.map(function (b) {
    return '<article class="branch-card" data-branch="' + esc(b.name) + '">' +
      '<div class="photo-slot branch-photo" data-img="branch.' + esc(b.id) + '.photo" data-label="' + esc(b.name) + ' 사진"></div>' +
      '<div class="branch-body">' +
        '<span class="region" data-ek="branch.' + esc(b.id) + '.region">' + esc(b.region) + "</span>" +
        '<h3 data-ek="branch.' + esc(b.id) + '.name">' + esc(b.name) + "</h3>" +
        '<p data-ek="branch.' + esc(b.id) + '.desc">' + esc(b.desc) + "</p>" +
        '<div class="branch-meta"><span data-ek="branch.' + esc(b.id) + '.size">' + esc(b.size) + "</span>" +
        '<span class="branch-open" data-ek="branch.' + esc(b.id) + '.opened">' + esc(b.opened) + " 오픈</span></div>" +
      "</div></article>";
  }).join("");
  $("branchGrid").addEventListener("click", function (e) {
    var card = e.target.closest(".branch-card");
    if (!card) return;
    state.branch = card.dataset.branch;
    renderAll();
    document.getElementById("jobs").scrollIntoView({ behavior: "smooth" });
  });

  /* ---------- FAQ ---------- */
  $("faqList").innerHTML = FAQS.map(function (f, i) {
    return '<div class="faq-item"><button class="faq-q" type="button" aria-expanded="false">' +
      '<span data-ek="faq.' + i + '.q">' + esc(f.q) + '</span></button>' +
      '<div class="faq-a" data-ek="faq.' + i + '.a">' + esc(f.a) + "</div></div>";
  }).join("");
  $("faqList").addEventListener("click", function (e) {
    var q = e.target.closest(".faq-q");
    if (!q) return;
    var item = q.parentElement;
    var open = item.classList.toggle("open");
    q.setAttribute("aria-expanded", open ? "true" : "false");
  });

  /* ---------- 직무 안내 탭 ---------- */
  var activeRole = ROLE_GUIDE[0].role;
  function renderRoleGuide() {
    $("roleTabs").innerHTML = ROLE_GUIDE.map(function (r) {
      return '<button type="button" class="role-tab' + (r.role === activeRole ? " active" : "") +
        '" data-role="' + esc(r.role) + '">' + esc(r.role) + "</button>";
    }).join("");
    var g = ROLE_GUIDE.filter(function (r) { return r.role === activeRole; })[0];
    var rk = "role." + g.role + ".";
    $("rolePanel").innerHTML =
      "<div><div class='role-icon'>" + esc(g.icon) + "</div>" +
      "<h3>" + esc(g.role) + "</h3>" +
      "<p class='sum' data-ek='" + rk + "summary'>" + esc(g.summary) + "</p>" +
      "<div class='grow'>성장 경로 · <span data-ek='" + rk + "grow'>" + esc(g.grow) + "</span></div>" +
      "<div class='photo-slot role-photo' data-img='" + rk + "photo' data-label='" + esc(g.role) + " 사진'></div>" +
      "</div>" +
      "<div><p class='role-day-title'>ONE DAY</p><ul class='role-day'>" +
      g.day.map(function (d, di) { return "<li data-ek='" + rk + "day." + di + "'>" + esc(d) + "</li>"; }).join("") +
      "</ul></div>";
  }
  $("roleTabs").addEventListener("click", function (e) {
    var t = e.target.closest(".role-tab");
    if (!t) return;
    activeRole = t.dataset.role;
    renderRoleGuide();
  });
  renderRoleGuide();

  /* ================================================================
     채용 공고 — 필터 · 렌더 · 모달
     ================================================================ */
  var state = { role: "전체", branch: "전체", type: "전체" };
  var visibleJobs = [];

  function allJobs() {
    return (STORE && STORE.getJobs().length) ? STORE.getJobs() : JOBS;
  }

  function renderChips(boxId, values, key) {
    $(boxId).innerHTML = ["전체"].concat(values).map(function (v) {
      return '<button type="button" class="chip' + (state[key] === v ? " active" : "") +
        '" data-key="' + key + '" data-value="' + esc(v) + '">' + esc(v) + "</button>";
    }).join("");
  }

  function renderJobs() {
    visibleJobs = allJobs().filter(function (j) {
      if (dday(j.deadline) < 0) return false;                       // 마감 자동 숨김
      if (state.role !== "전체" && j.role !== state.role) return false;
      if (state.branch !== "전체" && j.branch !== state.branch) return false;
      if (state.type !== "전체" && j.type !== state.type) return false;
      return true;
    }).sort(function (a, b) { return dday(a.deadline) - dday(b.deadline); });

    $("jobCount").textContent = visibleJobs.length;
    $("jobEmpty").hidden = visibleJobs.length > 0;

    $("jobList").innerHTML = visibleJobs.map(function (j, i) {
      var d = dday(j.deadline);
      var label = d === 0 ? "오늘 마감" : "D-" + d;
      var closing = d <= 7 ? " closing" : "";
      return '<article class="job-card" data-idx="' + i + '">' +
        '<div class="job-card-top">' +
          '<span class="job-badge role">' + esc(j.role) + "</span>" +
          '<span class="job-badge branch">' + esc(j.branch) + "</span>" +
          '<span class="job-badge type">' + esc(j.type) + "</span>" +
          '<span class="job-dday' + closing + '">' + label + "</span>" +
        "</div>" +
        '<h3 class="job-title">' + esc(j.title) + "</h3>" +
        (j.salary ? '<p class="job-salary">₩ ' + esc(j.salary) + "</p>" : "") +
        '<p class="job-desc">' + esc(j.desc) + "</p>" +
        '<div class="job-meta"><span>모집 ' + esc(j.headcount) + "명</span>" +
          "<span>~" + fmtDate(j.deadline) + "</span>" +
          ((j.tags || []).length ? "<span>" + (j.tags || []).map(function (t) { return "#" + esc(t); }).join(" ") + "</span>" : "") +
        "</div>" +
        '<a class="job-apply" href="#apply" data-apply="' + i + '">이 공고에 지원하기</a>' +
        "</article>";
    }).join("");
  }

  function renderAll() {
    renderChips("roleChips", ROLES, "role");
    renderChips("branchChips", BRANCHES.map(function (b) { return b.name; }), "branch");
    renderChips("typeChips", TYPES, "type");
    renderJobs();
  }

  $("jobs").addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (chip) { state[chip.dataset.key] = chip.dataset.value; renderAll(); return; }

    var apply = e.target.closest("[data-apply]");
    if (apply) { preselect(visibleJobs[Number(apply.dataset.apply)]); return; }

    var card = e.target.closest(".job-card");
    if (card) openModal(visibleJobs[Number(card.dataset.idx)]);
  });

  /* ---------- 상세 모달 ---------- */
  var modalJob = null;
  function openModal(job) {
    if (!job) return;
    modalJob = job;
    var d = dday(job.deadline);
    $("mBadges").innerHTML =
      '<span class="job-badge role">' + esc(job.role) + "</span>" +
      '<span class="job-badge branch">' + esc(job.branch) + "</span>" +
      '<span class="job-badge type">' + esc(job.type) + "</span>" +
      '<span class="job-dday' + (d <= 7 ? " closing" : "") + '">' + (d === 0 ? "오늘 마감" : "D-" + d) + "</span>";
    $("mTitle").textContent = job.title;
    $("mKv").innerHTML =
      "<div><b>공고번호</b>" + esc(job.id || "-") + "</div>" +
      "<div><b>모집인원</b>" + esc(job.headcount) + "명</div>" +
      "<div><b>게시일</b>" + fmtDate(job.posted) + "</div>" +
      "<div><b>마감일</b>" + fmtDate(job.deadline) + "</div>";

    function list(title, arr) {
      if (!arr || !arr.length) return "";
      return "<h4>" + title + "</h4><ul>" + arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
    }
    $("mBody").innerHTML =
      "<h4>포지션 소개</h4><p style='font-size:14px;color:var(--txt-dim)'>" + esc(job.desc) + "</p>" +
      (job.salary ? "<h4>보상</h4><p style='font-size:14px;color:var(--txt-dim)'>" + esc(job.salary) + "</p>" : "") +
      list("담당 업무", job.duties) +
      list("자격 요건", job.requires) +
      list("우대 사항", job.prefers);

    $("jobModal").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    $("jobModal").hidden = true;
    document.body.style.overflow = "";
  }
  $("modalClose").addEventListener("click", closeModal);
  $("jobModal").addEventListener("click", function (e) { if (e.target.id === "jobModal") closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });
  $("mApply").addEventListener("click", function () { preselect(modalJob); closeModal(); });

  /* ================================================================
     지원 폼
     ================================================================ */
  (function fillSelects() {
    $("fRole").innerHTML = '<option value="">선택해주세요</option>' +
      ROLES.map(function (r) { return "<option>" + esc(r) + "</option>"; }).join("");
    $("fBranch").innerHTML = '<option value="">선택해주세요</option>' +
      BRANCHES.map(function (b) { return "<option>" + esc(b.name) + "</option>"; }).join("") +
      "<option>지점 무관</option>";
  })();

  var selectedJobId = "";
  function preselect(job) {
    if (!job) return;
    selectedJobId = job.id || "";
    $("fRole").value = job.role;
    $("fBranch").value = job.branch;
    setTimeout(function () { $("fName").focus({ preventScroll: true }); }, 420);
  }

  $("applyForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target;
    // 주의: form.name / form.action 등은 HTMLFormElement 고유 속성과 충돌하므로 id로 접근
    var name = $("fName").value.trim(), phone = $("fPhone").value.trim();

    if (!name || !phone) { alert("이름과 연락처는 필수입니다."); return; }
    if (!$("fRole").value || !$("fBranch").value) { alert("지원 직무와 희망 지점을 선택해주세요."); return; }
    if (!$("fAgree").checked) { alert("개인정보 수집·이용에 동의해주세요."); return; }

    var payload = {
      name: name,
      phone: phone,
      email: $("fEmail").value.trim(),
      role: $("fRole").value,
      branch: $("fBranch").value,
      career: $("fCareer").value,
      start: $("fStart").value.trim(),
      memo: $("fMsg").value.trim(),
      jobId: selectedJobId,
      stage: "new",
      at: new Date().toISOString().slice(0, 10),
    };

    var btn = f.querySelector("button[type=submit]");
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "접수 중…";

    var ok = $("formOk");

    STORE.submitApplication(payload).then(function (res) {
      btn.disabled = false;
      btn.textContent = label;

      if (res.ok) {
        ok.className = "form-ok";
        ok.innerHTML = "<strong>" + esc(name) + "님, 지원이 접수되었습니다.</strong><br />" +
          "담당자가 48시간 내 " + esc(phone) + " 로 연락드립니다." +
          (res.local ? " <span style='opacity:.7'>(로컬 모드 — 이 브라우저에만 저장됩니다)</span>" : "");
      } else {
        // 서버 전송 실패 — 유실은 막았지만 사용자에게 대체 경로를 안내
        ok.className = "form-ok form-warn";
        ok.innerHTML = "<strong>일시적으로 접수가 지연되고 있습니다.</strong><br />" +
          "입력하신 내용은 저장해 두었습니다. 빠른 연락을 원하시면 " +
          "<a href='mailto:" + esc(BRAND.applyEmail) + "'>" + esc(BRAND.applyEmail) + "</a> 또는 " +
          "카카오톡 채널로 연락 주세요.";
      }
      ok.hidden = false;
      f.reset();
      selectedJobId = "";
      ok.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  /* ---------- 준비중 안내 바 ---------- */
  if (CFG.previewNotice) {
    var bar = document.createElement("div");
    bar.className = "notice-bar";
    bar.innerHTML = "본 사이트는 오픈 준비 중입니다 — 표기된 지점·공고·보상 조건은 <b>샘플 데이터</b>입니다." +
      '<button type="button" aria-label="닫기">×</button>';
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add("has-notice");
    bar.querySelector("button").addEventListener("click", function () {
      bar.remove();
      document.body.classList.remove("has-notice");
    });
  }

  /* ---------- 초기 렌더 ---------- */
  renderAll();

  // 원격 모드면 구글 시트의 최신 공고로 갱신
  if (STORE.mode === "remote") {
    STORE.refreshJobs().then(renderAll).catch(function (err) {
      console.warn("공고 원격 조회 실패 — data.js 목록을 표시합니다.", err);
    });
  }
})();
