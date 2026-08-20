/* ================================================================
   NOBEL GYM 24 — 공용 저장소
   ▸ config.applyEndpoint 가 비어 있으면  → 로컬 모드 (localStorage)
   ▸ 값이 들어 있으면                     → 원격 모드 (Google Sheets)
   두 모드 모두 같은 API를 노출하므로 화면 코드는 바뀌지 않습니다.
   ================================================================ */
(function (global) {
  "use strict";

  var CFG = global.NOBEL_CONFIG || {};
  var KEY = CFG.storageKey || "nobelgym.recruit.v1";
  var EP = (CFG.applyEndpoint || "").trim();
  var ADMIN_API = (CFG.adminApi || "").trim();
  var TOKEN = (CFG.adminToken || "").trim();   // 로컬 테스트용 직결 토큰 (권장하지 않음)
  var REMOTE = !!EP;
  var adminPass = "";                          // 어드민 로그인 시 주입

  /* ---------- data.js 는 const 선언이라 window 프로퍼티가 아님 ---------- */
  function srcJobs() { return typeof JOBS !== "undefined" ? JOBS : []; }
  function srcApplicants() { return typeof SEED_APPLICANTS !== "undefined" ? SEED_APPLICANTS : []; }

  /* ---------- localStorage ---------- */
  function canStore() {
    try { global.localStorage.setItem("__t", "1"); global.localStorage.removeItem("__t"); return true; }
    catch (e) { return false; }
  }
  var HAS_LS = canStore();
  var memory = null;

  function seed() {
    return {
      jobs: srcJobs().map(function (j) { return Object.assign({}, j); }),
      // 원격 모드에서는 데모 지원자를 만들지 않습니다 (실제 접수분만 표시)
      applicants: REMOTE ? [] : srcApplicants().map(function (a) { return Object.assign({}, a); }),
      seededAt: new Date().toISOString(),
    };
  }

  function read() {
    if (!HAS_LS) return memory || (memory = seed());
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) { var s = seed(); write(s); return s; }
      var p = JSON.parse(raw);
      if (!p.jobs || !p.applicants) { var s2 = seed(); write(s2); return s2; }
      return p;
    } catch (e) { return seed(); }
  }

  function write(state) {
    if (!HAS_LS) { memory = state; return; }
    try { global.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function uid(prefix) {
    return prefix + Math.random().toString(36).slice(2, 7).toUpperCase() +
      Date.now().toString(36).slice(-3).toUpperCase();
  }

  /* ---------- 원격 통신 (Google Apps Script) ----------
     Content-Type 을 text/plain 으로 보내 프리플라이트(OPTIONS)를 피합니다.
     Apps Script 웹앱은 OPTIONS 를 처리하지 못하기 때문입니다.            */
  function post(body) {
    return fetch(EP, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      redirect: "follow",
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (!res || res.ok !== true) throw new Error((res && res.error) || "서버 오류");
      return res;
    });
  }

  function get(params) {
    var qs = Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    }).join("&");
    return fetch(EP + "?" + qs, { redirect: "follow" })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || res.ok !== true) throw new Error((res && res.error) || "서버 오류");
        return res;
      });
  }

  /** 어드민 전용 요청
      · adminApi 가 있으면  → 중계 서버(Netlify Function)가 토큰을 붙여 전달
      · 없으면(정적 호스팅) → Apps Script 웹앱에 비밀번호를 실어 직접 요청
        비밀번호는 POST 본문으로만 가고 주소창에는 남지 않습니다.        */
  function adminCall(action, extra) {
    var body = Object.assign({ action: action }, extra || {});
    if (ADMIN_API) {
      body.pass = adminPass;
      return fetch(ADMIN_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (!res || res.ok !== true) throw new Error((res && res.error) || "서버 오류");
        return res;
      });
    }
    body.token = TOKEN || adminPass;
    if (!body.token) return Promise.reject(new Error("관리자 로그인이 필요합니다."));
    if (!REMOTE) return Promise.reject(new Error("어드민 API가 설정되지 않았습니다."));
    return post(body);
  }

  /* ---------- 캐시 (원격 모드용) ---------- */
  var cache = { jobs: null, applicants: [], content: null };

  /* ================================================================
     공개 API
     ================================================================ */
  global.NobelStore = {
    mode: REMOTE ? "remote" : "local",
    hasStorage: HAS_LS,
    endpointSet: REMOTE,
    adminApiSet: !!ADMIN_API,

    /** 어드민 로그인 시 호출 — 이후 어드민 요청에 비밀번호가 실립니다 */
    setAdminPass: function (pw) { adminPass = pw || ""; },

    /** 비밀번호 검증
        · adminAuth: "client" → config.adminPass 와 비교 (로컬 테스트)
        · adminApi 없음       → Apps Script 웹앱에 직접 물어봄 (정적 호스팅)
        · adminApi 있음       → 중계 서버에 물어봄, 401 이면 비밀번호 틀림     */
    verifyAdmin: function (pw) {
      var local = function () { return pw === (CFG.adminPass || "nobel2026"); };
      if (CFG.adminAuth === "client") return Promise.resolve(local());

      if (!ADMIN_API) {
        if (!REMOTE) return Promise.resolve(local());
        adminPass = pw;
        return post({ action: "list", token: pw })
          .then(function () { return true; })
          .catch(function (err) {
            adminPass = "";
            if (/인증/.test(String(err && err.message))) return false;
            throw new Error("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
          });
      }

      adminPass = pw;
      return fetch(ADMIN_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pass: pw, action: "listJobs" }),
      }).then(function (r) {
        if (r.status === 401) { adminPass = ""; return false; }
        if (!r.ok) throw new Error("function unavailable");
        return r.json().then(function (res) {
          if (res && res.ok === true) return true;
          throw new Error((res && res.error) || "unknown");
        });
      }).catch(function () {
        var ok = local();
        if (!ok) adminPass = "";
        return ok;
      });
    },

    /* ---------- 공고 ---------- */
    getJobs: function () {
      if (REMOTE) return cache.jobs || srcJobs();   // 아직 못 받아왔으면 data.js 로 먼저 표시
      return read().jobs;
    },

    refreshJobs: function () {
      if (!REMOTE) return Promise.resolve(this.getJobs());
      return get({ action: "listJobs" }).then(function (res) {
        // 시트가 비어 있으면 data.js 를 계속 사용 (최초 발행 전 상태)
        cache.jobs = (res.jobs && res.jobs.length) ? res.jobs : null;
        return cache.jobs || srcJobs();
      });
    },

    saveJob: function (job) {
      if (REMOTE) {
        return adminCall("saveJob", { job: job }).then(function (res) {
          job.id = job.id || res.id;
          return this.refreshJobs();
        }.bind(this));
      }
      var s = read(), i = -1;
      for (var k = 0; k < s.jobs.length; k++) if (s.jobs[k].id === job.id) { i = k; break; }
      if (i >= 0) s.jobs[i] = Object.assign({}, s.jobs[i], job);
      else { job.id = job.id || uid("J-"); s.jobs.unshift(job); }
      write(s);
      return Promise.resolve(s.jobs);
    },

    deleteJob: function (id) {
      if (REMOTE) {
        return adminCall("deleteJob", { id: id })
          .then(function () { return this.refreshJobs(); }.bind(this));
      }
      var s = read();
      s.jobs = s.jobs.filter(function (j) { return j.id !== id; });
      write(s);
      return Promise.resolve(s.jobs);
    },

    /** 최초 1회 — 현재 공고 목록을 구글 시트로 발행 */
    publishJobs: function () {
      if (!REMOTE) return Promise.reject(new Error("원격 모드가 아닙니다."));
      return adminCall("publishJobs", { jobs: this.getJobs() })
        .then(function (res) { return this.refreshJobs().then(function () { return res.count; }); }.bind(this));
    },

    /* ---------- 사이트 콘텐츠 (문구 · 사진) ---------- */
    getContent: function () { return cache.content || {}; },

    refreshContent: function () {
      if (!REMOTE) { cache.content = readLocalContent(); return Promise.resolve(cache.content); }
      return get({ action: "content" }).then(function (res) {
        cache.content = res.content || {};
        return cache.content;
      });
    },

    /** items: { key: value } — 값이 "" 이면 원래 문구로 되돌림 */
    saveContent: function (items) {
      if (!REMOTE) {
        var c = readLocalContent();
        Object.keys(items).forEach(function (k) {
          if (items[k] === "") delete c[k]; else c[k] = items[k];
        });
        writeLocalContent(c);
        cache.content = c;
        return Promise.resolve({ ok: true, local: true });
      }
      return adminCall("saveContent", { items: items }).then(function (res) {
        Object.keys(items).forEach(function (k) {
          if (items[k] === "") delete cache.content[k]; else cache.content[k] = items[k];
        });
        return res;
      });
    },

    /** dataUrl(base64) 을 구글 드라이브에 올리고 공개 URL 반환 */
    uploadImage: function (dataUrl, name) {
      var m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || "");
      if (!m) return Promise.reject(new Error("이미지 형식을 읽을 수 없습니다."));
      if (!REMOTE) return Promise.resolve({ ok: true, url: dataUrl, local: true });
      return adminCall("uploadImage", { mime: m[1], dataBase64: m[2], name: name || "image" });
    },

    /* ---------- 지원자 ---------- */
    getApplicants: function () {
      return REMOTE ? cache.applicants : read().applicants;
    },

    refreshApplicants: function () {
      if (!REMOTE) return Promise.resolve(this.getApplicants());
      return adminCall("list").then(function (res) {
        cache.applicants = res.applicants || [];
        return cache.applicants;
      });
    },

    /** 채용 사이트 지원 폼 제출 */
    submitApplication: function (payload) {
      if (!REMOTE) {
        this.addApplicantLocal(payload);
        return Promise.resolve({ ok: true, local: true });
      }
      return post(Object.assign({ action: "apply" }, payload))
        .then(function (res) { return { ok: true, id: res.id }; })
        .catch(function (err) {
          // 서버 실패 시 유실 방지 — 로컬에 남겨둡니다
          this.addApplicantLocal(payload);
          return { ok: false, offline: true, error: String(err.message || err) };
        }.bind(this));
    },

    addApplicantLocal: function (a) {
      var s = read();
      a.id = a.id || uid("A-");
      a.stage = a.stage || "new";
      a.at = a.at || new Date().toISOString().slice(0, 10);
      s.applicants.unshift(a);
      write(s);
      return a;
    },

    /** 어드민에서 직접 추가 */
    addApplicant: function (a) {
      if (REMOTE) {
        return post(Object.assign({ action: "apply" }, a))
          .then(function () { return this.refreshApplicants(); }.bind(this));
      }
      this.addApplicantLocal(a);
      return Promise.resolve(read().applicants);
    },

    updateApplicant: function (id, patch) {
      if (REMOTE) {
        // 낙관적 갱신 — 화면은 즉시 반영하고 서버 쓰기는 뒤따릅니다
        cache.applicants = cache.applicants.map(function (a) {
          return a.id === id ? Object.assign({}, a, patch) : a;
        });
        return adminCall("update", { id: id, patch: toSheetPatch(patch) });
      }
      var s = read();
      s.applicants = s.applicants.map(function (a) {
        return a.id === id ? Object.assign({}, a, patch) : a;
      });
      write(s);
      return Promise.resolve();
    },

    deleteApplicant: function (id) {
      if (REMOTE) {
        cache.applicants = cache.applicants.filter(function (a) { return a.id !== id; });
        return adminCall("delete", { id: id });
      }
      var s = read();
      s.applicants = s.applicants.filter(function (a) { return a.id !== id; });
      write(s);
      return Promise.resolve();
    },

    /* ---------- 유틸 ---------- */
    reset: function () {
      var s = seed(); write(s);
      cache.jobs = null; cache.applicants = [];
      return s;
    },

    exportJson: function () {
      return JSON.stringify({ jobs: this.getJobs(), applicants: this.getApplicants() }, null, 2);
    },

    importJson: function (text) {
      var p = JSON.parse(text);
      if (!p.jobs || !p.applicants) throw new Error("jobs / applicants 키가 필요합니다.");
      write(p);
      cache.jobs = null; cache.applicants = [];
    },
  };

  var LOCAL_CONTENT_KEY = KEY + ".content";
  function readLocalContent() {
    if (!HAS_LS) return cache.content || {};
    try { return JSON.parse(global.localStorage.getItem(LOCAL_CONTENT_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function writeLocalContent(c) {
    if (!HAS_LS) { cache.content = c; return; }
    try { global.localStorage.setItem(LOCAL_CONTENT_KEY, JSON.stringify(c)); } catch (e) {}
  }

  /* 어드민 내부 stage id → 시트에 적을 한글 라벨 */
  function toSheetPatch(patch) {
    var labels = {
      new: "신규 지원", screen: "서류 검토", interview: "면접 예정",
      demo: "실무 시연", offer: "처우 협의", hired: "입사 확정", reject: "불합격",
    };
    var out = Object.assign({}, patch);
    if (out.stage && labels[out.stage]) out.stage = labels[out.stage];
    return out;
  }
})(window);
