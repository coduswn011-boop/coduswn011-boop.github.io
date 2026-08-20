/* ================================================================
   NOBEL GYM 24 — 채용 어드민 스크립트 (프로토타입)
   ▸ 저장소: js/store.js (localStorage)
   ▸ 실서비스 전환 시 NobelStore 내부만 API 호출로 교체하면 됩니다.
   ================================================================ */
(function () {
  "use strict";

  var CFG = window.NOBEL_CONFIG || {};
  var S = window.NobelStore;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function dday(dl) { return Math.round((new Date(dl + "T00:00:00") - today()) / 86400000); }
  function fmt(d) { return String(d || "").replace(/-/g, "."); }
  function iso(d) { return d.toISOString().slice(0, 10); }

  var toastTimer;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  function opts(list, sel) {
    return list.map(function (v) {
      return '<option value="' + esc(v) + '"' + (v === sel ? " selected" : "") + ">" + esc(v) + "</option>";
    }).join("");
  }

  /* ================================================================
     로그인 게이트
     ================================================================ */
  var SESSION_KEY = "nobelgym.admin.session";
  function enter() {
    $("gate").style.display = "none";
    $("app").classList.add("on");
    renderAll();
    syncBadge();
    if (S.mode === "remote") sync(true);
  }

  /* ---------- 원격 동기화 ---------- */
  function syncBadge() {
    var el = $("modeBadge");
    if (!el) return;
    if (S.mode === "remote") {
      el.textContent = "구글 시트 연결됨";
      el.className = "mode-badge on";
    } else {
      el.textContent = "로컬 모드 (이 브라우저에만 저장)";
      el.className = "mode-badge";
    }
    $("btnSync").hidden = S.mode !== "remote";
    $("btnPublish").hidden = S.mode !== "remote";
  }

  function sync(silent) {
    if (S.mode !== "remote") { renderAll(); return Promise.resolve(); }
    var btn = $("btnSync");
    if (btn) { btn.disabled = true; btn.textContent = "동기화 중…"; }
    return Promise.all([S.refreshJobs(), S.refreshApplicants()])
      .then(function () {
        renderAll();
        if (!silent) toast("구글 시트와 동기화했습니다.");
      })
      .catch(function (err) {
        toast("동기화 실패: " + (err.message || err));
      })
      .then(function () {
        if (btn) { btn.disabled = false; btn.textContent = "새로고침"; }
      });
  }
  $("gateBtn").addEventListener("click", tryLogin);
  $("gatePw").addEventListener("keydown", function (e) { if (e.key === "Enter") tryLogin(); });
  (function gateHint() {
    var el = $("gateHint"); if (!el) return;
    el.innerHTML = (CFG.adminAuth === "client" || (!CFG.adminApi && !CFG.applyEndpoint))
      ? "로컬 모드 비밀번호: <b>" + esc(CFG.adminPass || "nobel2026") + "</b><br />배포 후에는 서버 검증으로 전환됩니다."
      : CFG.adminApi
        ? "비밀번호는 호스팅 환경변수 <b>ADMIN_PASS</b> 값입니다."
        : "비밀번호는 Apps Script 의 <b>ADMIN_PASS</b> 값입니다.";
  })();

  function tryLogin() {
    var pw = $("gatePw").value;
    var btn = $("gateBtn");
    btn.disabled = true; btn.textContent = "확인 중…";

    S.verifyAdmin(pw).then(function (ok) {
      btn.disabled = false; btn.textContent = "입장";
      if (ok) {
        S.setAdminPass(pw);
        try {
          sessionStorage.setItem(SESSION_KEY, pw);
          // 사이트 인라인 편집기가 읽는 값 (같은 출처의 localStorage 공유)
          localStorage.setItem("nobelgym.editor", pw);
        } catch (e) {}
        enter();
      } else {
        $("gatePw").value = "";
        $("gatePw").placeholder = "비밀번호가 틀렸습니다";
      }
    });
  }

  // 새로고침해도 세션 유지
  try {
    var saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) { S.setAdminPass(saved); enter(); }
  } catch (e) {}

  /* ================================================================
     탭 전환
     ================================================================ */
  document.querySelector(".tabs").addEventListener("click", function (e) {
    var t = e.target.closest(".tab");
    if (!t) return;
    document.querySelectorAll(".tab").forEach(function (x) { x.classList.toggle("on", x === t); });
    document.querySelectorAll(".page").forEach(function (p) {
      p.classList.toggle("on", p.id === "page-" + t.dataset.page);
    });
  });

  /* ================================================================
     렌더 총괄
     ================================================================ */
  function countApplicants(jobId) {
    return S.getApplicants().filter(function (a) { return a.jobId === jobId; }).length;
  }

  function renderAll() {
    renderDash();
    renderJobFilters();
    renderJobTable();
    renderAppFilters();
    renderKanban();
  }

  /* ---------- 대시보드 ---------- */
  function renderDash() {
    var jobs = S.getJobs(), apps = S.getApplicants();
    var live = jobs.filter(function (j) { return dday(j.deadline) >= 0; });
    var openHead = live.reduce(function (n, j) { return n + Number(j.headcount || 0); }, 0);
    var week = new Date(today().getTime() - 6 * 86400000);
    var newThisWeek = apps.filter(function (a) { return new Date(a.at + "T00:00:00") >= week; }).length;
    var inProgress = apps.filter(function (a) { return ["screen", "interview", "demo", "offer"].indexOf(a.stage) >= 0; }).length;
    var hired = apps.filter(function (a) { return a.stage === "hired"; }).length;

    $("statRow").innerHTML = [
      ["게시중 공고", live.length + "건"],
      ["총 모집 인원", openHead + "명"],
      ["전체 지원자", apps.length + "명"],
      ["최근 7일 신규", newThisWeek + "명"],
      ["진행중 전형", inProgress + "명"],
      ["입사 확정", hired + "명"],
    ].map(function (s) {
      return "<div class='stat'><b>" + esc(s[1]) + "</b><span>" + esc(s[0]) + "</span></div>";
    }).join("");

    var soon = live.filter(function (j) { return dday(j.deadline) <= 7; })
      .sort(function (a, b) { return dday(a.deadline) - dday(b.deadline); });
    $("soonBody").innerHTML = soon.length ? soon.map(function (j) {
      var d = dday(j.deadline);
      return "<tr><td class='title-cell'>" + esc(j.title) + "</td>" +
        "<td><span class='pill role'>" + esc(j.role) + "</span></td>" +
        "<td>" + esc(j.branch) + "</td>" +
        "<td><span class='pill soon'>" + (d === 0 ? "오늘 마감" : "D-" + d) + "</span> " + fmt(j.deadline) + "</td>" +
        "<td>" + countApplicants(j.id) + "명</td></tr>";
    }).join("") : "<tr><td colspan='5' style='color:#8E949D'>마감 임박 공고가 없습니다.</td></tr>";

    var recent = apps.slice().sort(function (a, b) { return b.at.localeCompare(a.at); }).slice(0, 6);
    $("recentBody").innerHTML = recent.map(function (a) {
      var st = STAGES.filter(function (s) { return s.id === a.stage; })[0] || STAGES[0];
      return "<tr><td style='font-weight:700'>" + esc(a.name) + "</td>" +
        "<td><span class='pill role'>" + esc(a.role) + "</span></td>" +
        "<td>" + esc(a.branch) + "</td><td>" + esc(a.career || "-") + "</td>" +
        "<td><span class='pill' style='background:" + st.color + "22;color:" + st.color + "'>" + esc(st.label) + "</span></td>" +
        "<td>" + fmt(a.at) + "</td></tr>";
    }).join("");
  }

  /* ---------- 공고 관리 ---------- */
  var jf = { role: "전체 직무", branch: "전체 지점", status: "all", q: "" };

  function renderJobFilters() {
    $("jfRole").innerHTML = opts(["전체 직무"].concat(ROLES), jf.role);
    $("jfBranch").innerHTML = opts(["전체 지점"].concat(BRANCHES.map(function (b) { return b.name; })), jf.branch);
  }
  ["jfRole", "jfBranch", "jfStatus", "jfQuery"].forEach(function (id) {
    $(id).addEventListener("input", function () {
      jf.role = $("jfRole").value; jf.branch = $("jfBranch").value;
      jf.status = $("jfStatus").value; jf.q = $("jfQuery").value.trim();
      renderJobTable();
    });
  });

  function renderJobTable() {
    var rows = S.getJobs().filter(function (j) {
      var isLive = dday(j.deadline) >= 0;
      if (jf.role !== "전체 직무" && j.role !== jf.role) return false;
      if (jf.branch !== "전체 지점" && j.branch !== jf.branch) return false;
      if (jf.status === "live" && !isLive) return false;
      if (jf.status === "closed" && isLive) return false;
      if (jf.q && j.title.indexOf(jf.q) < 0) return false;
      return true;
    }).sort(function (a, b) { return (b.posted || "").localeCompare(a.posted || ""); });

    $("jobEmpty").hidden = rows.length > 0;
    $("jobBody").innerHTML = rows.map(function (j) {
      var d = dday(j.deadline);
      var status = d < 0
        ? "<span class='pill closed'>마감</span>"
        : (d <= 7 ? "<span class='pill soon'>D-" + d + "</span>" : "<span class='pill live'>게시중</span>");
      return "<tr data-id='" + esc(j.id) + "'>" +
        "<td>" + status + "</td>" +
        "<td class='title-cell'>" + esc(j.title) + "</td>" +
        "<td><span class='pill role'>" + esc(j.role) + "</span></td>" +
        "<td>" + esc(j.branch) + "</td>" +
        "<td><span class='pill type'>" + esc(j.type) + "</span></td>" +
        "<td>" + esc(j.headcount) + "명</td>" +
        "<td>" + fmt(j.deadline) + "</td>" +
        "<td>" + countApplicants(j.id) + "명</td>" +
        "<td><div class='row-actions'>" +
          "<button class='btn btn-sm' data-edit='" + esc(j.id) + "'>수정</button>" +
          "<button class='btn btn-sm btn-danger' data-del='" + esc(j.id) + "'>삭제</button>" +
        "</div></td></tr>";
    }).join("");
  }

  $("jobBody").addEventListener("click", function (e) {
    var ed = e.target.closest("[data-edit]");
    if (ed) { openJobModal(ed.dataset.edit); return; }
    var dl = e.target.closest("[data-del]");
    if (dl) {
      if (confirm("이 공고를 삭제할까요? 되돌릴 수 없습니다.")) {
        S.deleteJob(dl.dataset.del)
          .then(function () { renderAll(); toast("공고를 삭제했습니다."); })
          .catch(function (err) { alert("삭제 실패: " + (err.message || err)); });
      }
    }
  });

  /* ---------- 공고 모달 ---------- */
  var editingJobId = null;

  function openJobModal(id) {
    editingJobId = id || null;
    var j = id ? S.getJobs().filter(function (x) { return x.id === id; })[0] : null;

    $("jmTitle").textContent = j ? "공고 수정" : "공고 등록";
    $("jmDelete").style.display = j ? "" : "none";

    $("jRole").innerHTML = opts(ROLES, j ? j.role : ROLES[0]);
    $("jBranch").innerHTML = opts(BRANCHES.map(function (b) { return b.name; }), j ? j.branch : BRANCHES[0].name);
    $("jType").innerHTML = opts(TYPES, j ? j.type : TYPES[0]);

    $("jTitle").value = j ? j.title : "";
    $("jHead").value = j ? j.headcount : 1;
    $("jPosted").value = j ? j.posted : iso(today());
    $("jDeadline").value = j ? j.deadline : iso(new Date(today().getTime() + 30 * 86400000));
    $("jSalary").value = j ? (j.salary || "") : "";
    $("jDesc").value = j ? j.desc : "";
    $("jDuties").value = j ? (j.duties || []).join("\n") : "";
    $("jRequires").value = j ? (j.requires || []).join("\n") : "";
    $("jPrefers").value = j ? (j.prefers || []).join("\n") : "";
    $("jTags").value = j ? (j.tags || []).join(", ") : "";

    $("jobModal").hidden = false;
  }
  function closeJobModal() { $("jobModal").hidden = true; editingJobId = null; }

  $("btnNewJob").addEventListener("click", function () { openJobModal(null); });
  $("jmClose").addEventListener("click", closeJobModal);
  $("jmCancel").addEventListener("click", closeJobModal);
  $("jobModal").addEventListener("click", function (e) { if (e.target.id === "jobModal") closeJobModal(); });

  $("jmSave").addEventListener("click", function () {
    var title = $("jTitle").value.trim(), desc = $("jDesc").value.trim(), dl = $("jDeadline").value;
    if (!title || !desc || !dl) { alert("공고명 · 설명 · 마감일은 필수입니다."); return; }

    function lines(id) {
      return $(id).value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    }
    var wasEditing = editingJobId;
    S.saveJob({
      id: editingJobId || undefined,
      title: title,
      role: $("jRole").value,
      branch: $("jBranch").value,
      type: $("jType").value,
      headcount: Number($("jHead").value) || 1,
      posted: $("jPosted").value || iso(today()),
      deadline: dl,
      salary: $("jSalary").value.trim(),
      desc: desc,
      duties: lines("jDuties"),
      requires: lines("jRequires"),
      prefers: lines("jPrefers"),
      tags: $("jTags").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean),
    }).then(function () {
      closeJobModal(); renderAll();
      toast(wasEditing ? "공고를 수정했습니다." : "공고를 등록했습니다.");
    }).catch(function (err) {
      alert("저장 실패: " + (err.message || err));
    });
  });

  $("jmDelete").addEventListener("click", function () {
    if (!editingJobId) return;
    if (confirm("이 공고를 삭제할까요?")) {
      S.deleteJob(editingJobId)
        .then(function () { closeJobModal(); renderAll(); toast("공고를 삭제했습니다."); })
        .catch(function (err) { alert("삭제 실패: " + (err.message || err)); });
    }
  });

  /* ================================================================
     지원자 파이프라인 (칸반)
     ================================================================ */
  var af = { role: "전체 직무", branch: "전체 지점", q: "" };

  function renderAppFilters() {
    $("afRole").innerHTML = opts(["전체 직무"].concat(ROLES), af.role);
    $("afBranch").innerHTML = opts(["전체 지점"].concat(BRANCHES.map(function (b) { return b.name; })), af.branch);
  }
  ["afRole", "afBranch", "afQuery"].forEach(function (id) {
    $(id).addEventListener("input", function () {
      af.role = $("afRole").value; af.branch = $("afBranch").value; af.q = $("afQuery").value.trim();
      renderKanban();
    });
  });

  function filteredApps() {
    return S.getApplicants().filter(function (a) {
      if (af.role !== "전체 직무" && a.role !== af.role) return false;
      if (af.branch !== "전체 지점" && a.branch !== af.branch) return false;
      if (af.q && (a.name + a.phone).indexOf(af.q) < 0) return false;
      return true;
    });
  }

  function renderKanban() {
    var apps = filteredApps();
    $("kanban").innerHTML = STAGES.map(function (st) {
      var list = apps.filter(function (a) { return a.stage === st.id; });
      return "<section class='col' data-stage='" + st.id + "'>" +
        "<div class='col-head'><span class='col-dot' style='background:" + st.color + "'></span>" +
        "<b>" + esc(st.label) + "</b><span class='cnt'>" + list.length + "</span></div>" +
        "<div class='col-body'>" + list.map(cardHtml).join("") + "</div></section>";
    }).join("");
    bindDnD();
  }

  function cardHtml(a) {
    var idx = STAGES.map(function (s) { return s.id; }).indexOf(a.stage);
    return "<article class='appcard' draggable='true' data-id='" + esc(a.id) + "'>" +
      "<div class='nm'>" + esc(a.name) + "<span>" + esc(a.career || "-") + "</span></div>" +
      "<div class='meta'>" + esc(a.role) + " · " + esc(a.branch) + "</div>" +
      "<div class='meta'>" + esc(a.phone) + "</div>" +
      "<div class='meta' style='opacity:.7'>접수 " + fmt(a.at) + "</div>" +
      (a.memo ? "<div class='memo'>" + esc(a.memo) + "</div>" : "") +
      "<div class='mv'>" +
        "<button data-mv='-1' data-id='" + esc(a.id) + "'" + (idx <= 0 ? " disabled" : "") + ">◀</button>" +
        "<button data-mv='1' data-id='" + esc(a.id) + "'" + (idx >= STAGES.length - 1 ? " disabled" : "") + ">▶</button>" +
      "</div></article>";
  }

  $("kanban").addEventListener("click", function (e) {
    var mv = e.target.closest("[data-mv]");
    if (mv) {
      e.stopPropagation();
      var a = S.getApplicants().filter(function (x) { return x.id === mv.dataset.id; })[0];
      if (!a) return;
      var ids = STAGES.map(function (s) { return s.id; });
      var next = ids[Math.min(ids.length - 1, Math.max(0, ids.indexOf(a.stage) + Number(mv.dataset.mv)))];
      S.updateApplicant(a.id, { stage: next })
        .catch(function (err) { toast("단계 저장 실패: " + (err.message || err)); });
      renderKanban(); renderDash();
      return;
    }
    var card = e.target.closest(".appcard");
    if (card) openAppModal(card.dataset.id);
  });

  /* ---------- 드래그 앤 드롭 ---------- */
  var dragId = null;
  function bindDnD() {
    document.querySelectorAll(".appcard").forEach(function (c) {
      c.addEventListener("dragstart", function (e) {
        dragId = c.dataset.id;
        c.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", dragId); } catch (err) {}
      });
      c.addEventListener("dragend", function () { c.classList.remove("dragging"); dragId = null; });
    });
    document.querySelectorAll(".col").forEach(function (col) {
      col.addEventListener("dragover", function (e) { e.preventDefault(); col.classList.add("drop"); });
      col.addEventListener("dragleave", function () { col.classList.remove("drop"); });
      col.addEventListener("drop", function (e) {
        e.preventDefault();
        col.classList.remove("drop");
        var id = dragId || e.dataTransfer.getData("text/plain");
        if (!id) return;
        S.updateApplicant(id, { stage: col.dataset.stage })
          .catch(function (err) { toast("단계 저장 실패: " + (err.message || err)); });
        renderKanban(); renderDash();
        toast("단계를 이동했습니다.");
      });
    });
  }

  /* ---------- 지원자 모달 ---------- */
  var editingAppId = null;

  function openAppModal(id) {
    editingAppId = id || null;
    var a = id ? S.getApplicants().filter(function (x) { return x.id === id; })[0] : null;

    $("amTitle").textContent = a ? "지원자 상세 — " + a.name : "지원자 추가";
    $("amDelete").style.display = a ? "" : "none";

    $("aRole").innerHTML = opts(ROLES, a ? a.role : ROLES[0]);
    $("aBranch").innerHTML = opts(BRANCHES.map(function (b) { return b.name; }), a ? a.branch : BRANCHES[0].name);
    $("aStage").innerHTML = STAGES.map(function (s) {
      return "<option value='" + s.id + "'" + (a && a.stage === s.id ? " selected" : "") + ">" + esc(s.label) + "</option>";
    }).join("");
    $("aJob").innerHTML = "<option value=''>(공고 미지정 · 상시지원)</option>" +
      S.getJobs().map(function (j) {
        return "<option value='" + esc(j.id) + "'" + (a && a.jobId === j.id ? " selected" : "") + ">" + esc(j.title) + "</option>";
      }).join("");

    $("aName").value = a ? a.name : "";
    $("aPhone").value = a ? a.phone : "";
    $("aEmail").value = a ? (a.email || "") : "";
    $("aCareer").value = a ? (a.career || "") : "";
    $("aMemo").value = a ? (a.memo || "") : "";

    $("appModal").hidden = false;
  }
  function closeAppModal() { $("appModal").hidden = true; editingAppId = null; }

  $("btnNewApp").addEventListener("click", function () { openAppModal(null); });
  $("amClose").addEventListener("click", closeAppModal);
  $("amCancel").addEventListener("click", closeAppModal);
  $("appModal").addEventListener("click", function (e) { if (e.target.id === "appModal") closeAppModal(); });

  $("amSave").addEventListener("click", function () {
    var name = $("aName").value.trim(), phone = $("aPhone").value.trim();
    if (!name || !phone) { alert("이름과 연락처는 필수입니다."); return; }
    var patch = {
      name: name, phone: phone,
      email: $("aEmail").value.trim(),
      career: $("aCareer").value.trim(),
      role: $("aRole").value, branch: $("aBranch").value,
      stage: $("aStage").value, jobId: $("aJob").value,
      memo: $("aMemo").value.trim(),
    };
    var was = editingAppId;
    var op = was ? S.updateApplicant(was, patch) : S.addApplicant(patch);
    closeAppModal(); renderAll();
    op.then(function () {
      renderAll();
      toast(was ? "지원자 정보를 저장했습니다." : "지원자를 추가했습니다.");
    }).catch(function (err) { toast("저장 실패: " + (err.message || err)); });
  });

  $("amDelete").addEventListener("click", function () {
    if (!editingAppId) return;
    if (confirm("이 지원자를 삭제할까요?")) {
      var id = editingAppId;
      closeAppModal();
      S.deleteApplicant(id)
        .then(function () { renderAll(); toast("지원자를 삭제했습니다."); })
        .catch(function (err) { toast("삭제 실패: " + (err.message || err)); });
      renderAll();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeJobModal(); closeAppModal(); }
  });

  /* ================================================================
     데이터 내보내기 / 가져오기 / 초기화
     ================================================================ */
  $("btnExport").addEventListener("click", function () {
    var blob = new Blob([S.exportJson()], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "nobelgym-recruit-" + iso(new Date()) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("JSON 파일로 내보냈습니다.");
  });

  $("btnImport").addEventListener("click", function () {
    if (S.mode === "remote") {
      alert("구글 시트에 연결된 상태에서는 가져오기를 사용할 수 없습니다.");
      return;
    }
    var input = document.createElement("input");
    input.type = "file"; input.accept = "application/json";
    input.addEventListener("change", function () {
      var file = input.files[0]; if (!file) return;
      var fr = new FileReader();
      fr.onload = function () {
        try { S.importJson(String(fr.result)); renderAll(); toast("데이터를 가져왔습니다."); }
        catch (err) { alert("가져오기 실패: " + err.message); }
      };
      fr.readAsText(file);
    });
    input.click();
  });

  $("btnSync").addEventListener("click", function () { sync(false); });

  $("btnPublish").addEventListener("click", function () {
    if (!confirm("현재 공고 목록을 구글 시트로 발행합니다.\n시트의 기존 공고는 모두 대체됩니다. 계속할까요?")) return;
    var b = $("btnPublish"); b.disabled = true; b.textContent = "발행 중…";
    S.publishJobs().then(function (n) {
      renderAll(); toast(n + "건의 공고를 시트로 발행했습니다.");
    }).catch(function (err) {
      alert("발행 실패: " + (err.message || err));
    }).then(function () { b.disabled = false; b.textContent = "공고 발행"; });
  });

  $("btnReset").addEventListener("click", function () {
    if (S.mode === "remote") {
      alert("구글 시트에 연결된 상태에서는 초기화를 사용할 수 없습니다.\n시트에서 직접 행을 지워주세요.");
      return;
    }
    if (confirm("모든 공고·지원자 데이터를 샘플 상태로 초기화합니다. 계속할까요?")) {
      S.reset(); renderAll(); toast("샘플 데이터로 초기화했습니다.");
    }
  });
})();
