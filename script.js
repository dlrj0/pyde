// ═══════════════════════════════════════════════════════════════
// ⓪ localStorage 네임스페이스 & 스토리지 관리
// ═══════════════════════════════════════════════════════════════

const PYGUIDE_PREFIX = 'pyguide_';

const PYGUIDE_KEYS = {
  pyguide_tab:       '현재 탭 위치',
  pyguide_quiz:      '퀴즈 진행률',
  pyguide_blocks:    '블록 접기/펼치기 상태',
  pyguide_bm:        '북마크',
  pyguide_dark:      '다크 모드 설정',
  pyguide_fslevel:   '글자 크기 설정',
  pyguide_toc:       '목차 열림 상태',
  pyguide_studytime: '학습 시간 트래커 (탭별 누적)',
};

function _calcBytes(key, value) {
  return (key.length + (value ? value.length : 0)) * 2;
}

function analyzeStorage() {
  const current = [];
  const orphans = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PYGUIDE_PREFIX)) continue;
      const value = localStorage.getItem(key);
      const bytes = _calcBytes(key, value);
      if (PYGUIDE_KEYS[key] !== undefined) {
        current.push({ key, label: PYGUIDE_KEYS[key], bytes, hasData: value !== null });
      } else {
        orphans.push({ key, bytes });
      }
    }
  } catch(e) {}
  return { current, orphans };
}

function _fmtBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  return (bytes / 1024).toFixed(1) + ' KB';
}

function cleanOrphanKeys() {
  try {
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PYGUIDE_PREFIX) && PYGUIDE_KEYS[key] === undefined) {
        toDelete.push(key);
      }
    }
    if (toDelete.length > 0) toDelete.forEach(k => localStorage.removeItem(k));
  } catch(e) {}
}

function openStorageModal() {
  const info = analyzeStorage();
  const modal = document.getElementById('storage-modal');
  const body  = document.getElementById('storage-modal-body');

  const currentTotal = info.current.reduce((s, x) => s + x.bytes, 0);
  const orphanTotal  = info.orphans.reduce((s, x) => s + x.bytes, 0);
  const grandTotal   = currentTotal + orphanTotal;
  const totalCount   = info.current.length + info.orphans.length;

  let html = '';

  if (totalCount === 0) {
    html = '<p class="smi-empty-note">이 사이트에 저장된 데이터가 없습니다.</p>';
  } else {
    if (info.current.length > 0) {
      html += `<div class="smi-section">
        <div class="smi-section-head">
          <span class="smi-tag current">현재</span>
          <span class="smi-head-label">사이트 저장 데이터</span>
          <span class="smi-head-size">${info.current.length}종&nbsp;·&nbsp;${_fmtBytes(currentTotal)}</span>
        </div>
        <ul class="smi-list">`;
      info.current.forEach(k => {
        html += `<li>
          <span class="smi-item-label">${k.label}</span>
          <span class="smi-item-bytes ${k.hasData ? '' : 'empty'}">${k.hasData ? _fmtBytes(k.bytes) : '비어있음'}</span>
        </li>`;
      });
      html += `</ul></div>`;
    }
    if (info.orphans.length > 0) {
      html += `<div class="smi-section smi-orphan">
        <div class="smi-section-head">
          <span class="smi-tag orphan">구버전</span>
          <span class="smi-head-label">사용하지 않는 잔여 데이터</span>
          <span class="smi-head-size">${info.orphans.length}종&nbsp;·&nbsp;${_fmtBytes(orphanTotal)}</span>
        </div>
        <ul class="smi-list">`;
      info.orphans.forEach(k => {
        html += `<li>
          <span class="smi-item-label smi-key-raw">${k.key}</span>
          <span class="smi-item-bytes">${_fmtBytes(k.bytes)}</span>
        </li>`;
      });
      html += `</ul></div>`;
    }
    html += `<div class="smi-total">
      <span>삭제되는 항목 합계</span>
      <span class="smi-total-val">${totalCount}종 · ${_fmtBytes(grandTotal)}</span>
    </div>`;
  }

  body.innerHTML = html;
  modal.classList.add('open');
}

function closeStorageModal() {
  document.getElementById('storage-modal').classList.remove('open');
}

function confirmReset() {
  closeStorageModal();
  try {
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PYGUIDE_PREFIX)) toDelete.push(key);
    }
    toDelete.forEach(k => localStorage.removeItem(k));
  } catch(e) {}
  location.reload();
}

// ═══════════════════════════════════════════════════════════════
// ① 메인 (탭전환 / 퀴즈 / Pyodide 터미널 / 접기펼치기)
// ═══════════════════════════════════════════════════════════════

// 탭 전환
const tabs = document.querySelectorAll('.tab');
const secs = document.querySelectorAll('.section');
function go(i) {
  tabs.forEach((t, j) => t.classList.toggle('on', i === j));
  secs.forEach((s, j) => s.classList.toggle('on', i === j));
  saveProgress('pyguide_tab', i);
  // 목차 사이드바 재빌드 (initToc에서 설정된 콜백 호출)
  if (typeof window._onTabChange === 'function') window._onTabChange(i);
}

// ═══════════════════════════════════════════════════════════════
//  localStorage 진도 저장
// ═══════════════════════════════════════════════════════════════

function saveProgress(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}

function _loadRaw(key) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : null;
  } catch(e) { return null; }
}

// 전체 진행률 업데이트 (풀어본 문제 수 기반 — 정답 + 오답 모두 포함)
function updateOverallProgress() {
  const quizData = _loadRaw('pyguide_quiz') || {};
  const allQs = document.querySelectorAll('.quiz-q');
  const total = allQs.length;
  if (!total) return;

  // 현재 DOM에 실제로 존재하는 키만 유효하다고 판단
  // (페이지 업데이트로 질문이 추가/삭제된 경우 stale 데이터 제거)
  const validKeys = new Set();
  document.querySelectorAll('.section').forEach((sec, secIdx) => {
    sec.querySelectorAll('.quiz-q').forEach((_, qi) => {
      validKeys.add(`${secIdx}_${qi}`);
    });
  });

  // 풀어본 문제 수 = 정답(true) + 오답(false) 모두 카운트
  const answered = Object.entries(quizData)
    .filter(([k, v]) => validKeys.has(k) && v !== undefined)
    .length;

  const pct = Math.round(answered / total * 100);
  const fill = document.getElementById('overall-progress-fill');
  const label = document.getElementById('overall-progress-label');
  if (fill) fill.style.width = pct + '%';
  if (label) label.textContent = answered + '/' + total;
}

// 탭 뱃지 업데이트 (완료 n/m)
function updateTabBadge(secIdx) {
  const badge = document.getElementById(`tab-badge-${secIdx}`);
  if (!badge) return;
  const sec = document.querySelectorAll('.section')[secIdx];
  if (!sec) return;
  const total = sec.querySelectorAll('.quiz-q').length;
  if (!total) { badge.style.display = 'none'; return; }
  const quizData = _loadRaw('pyguide_quiz') || {};
  let correct = 0;
  sec.querySelectorAll('.quiz-q').forEach((q, qi) => {
    const k = `${secIdx}_${qi}`;
    if (quizData[k] === true) correct++;
  });
  badge.textContent = `완료 ${correct}/${total}`;
  badge.classList.toggle('has-answered', correct > 0 && correct < total);
  badge.classList.toggle('all-answered', correct === total);
  badge.style.display = total > 0 ? '' : 'none';
}

// 모든 탭 뱃지 갱신
function updateAllTabBadges() {
  document.querySelectorAll('.section').forEach((_, i) => updateTabBadge(i));
}

// 전체 초기화 — 삭제 전 스토리지 정보 모달 표시
function resetAllProgress() {
  openStorageModal();
}

// 진도 복원 (페이지 로드 시)
function loadProgress() {
  const quizData = _loadRaw('pyguide_quiz') || {};
  const blockData = _loadRaw('pyguide_blocks') || {};

  // ── 퀴즈 정답 복원 ────────────────────────────────────────────
  document.querySelectorAll('.section').forEach((sec, secIdx) => {
    sec.querySelectorAll('.quiz-q').forEach((q, qi) => {
      const k = `${secIdx}_${qi}`;
      const saved = quizData[k];
      if (saved === undefined) return;
      const correct = q.dataset.correct;
      if (correct) {
        // 객관식
        q.dataset.answered = '1';
        q.querySelectorAll('.opt').forEach(b => {
          b.disabled = true;
          if (b.dataset.idx === correct) b.classList.add('correct');
        });
        const exp = q.querySelector('.q-exp');
        if (exp) exp.classList.add('show', saved ? 'ok' : 'fail');
      } else if (q.dataset.answer) {
        // 주관식
        q.dataset.answered = '1';
        const inp = q.querySelector('.sa-inp');
        const btn = q.querySelector('.sa-btn');
        if (inp) {
          inp.disabled = true;
          inp.value = saved === true ? q.dataset.answer : '(오답)';
          inp.style.borderColor = saved ? '#1D9E75' : '#D85A30';
          inp.style.color = saved ? '#1D9E75' : '#D85A30';
        }
        if (btn) btn.disabled = true;
        const exp = q.querySelector('.q-exp');
        if (exp) {
          exp.innerHTML = saved
            ? `<strong>✅ 정답입니다!</strong> 정답: <code>${q.dataset.answer}</code>`
            : `<strong>❌ 오답.</strong> 정답: <code>${q.dataset.answer}</code>`;
          exp.classList.add('show', saved ? 'ok' : 'fail');
        }
      }
    });
  });

  // ── 블록 접힘 복원 ─────────────────────────────────────────────
  Object.entries(blockData).forEach(([key, collapsed]) => {
    if (!collapsed) return;
    const body = document.querySelector(`.block-body[data-key="${key}"]`);
    if (body) {
      body.classList.add('collapsed');
      const block = body.parentElement;
      if (block) {
        const btn = block.querySelector('.block-toggle');
        if (btn) btn.classList.add('is-collapsed');
      }
      _blockCollapseState[key] = true;
    }
  });

  // ── 탭 복원 ────────────────────────────────────────────────────
  const savedTab = _loadRaw('pyguide_tab');
  if (savedTab !== null && savedTab >= 0 && savedTab < tabs.length) {
    go(savedTab);
  }

  updateAllTabBadges();
  updateOverallProgress();
}

// 탭 뱃지 주입 (initQuizScores 실행 후 호출)
function injectTabBadges() {
  document.querySelectorAll('.tab').forEach((tab, i) => {
    if (document.getElementById(`tab-badge-${i}`)) return;
    const sec = document.querySelectorAll('.section')[i];
    if (!sec) return;
    const total = sec.querySelectorAll('.quiz-q').length;
    if (!total) return;
    const badge = document.createElement('span');
    badge.className = 'tab-badge';
    badge.id = `tab-badge-${i}`;
    badge.textContent = `완료 0/${total}`;
    tab.appendChild(badge);
  });
}

// ── ① 퀴즈 점수 추적 ──────────────────────────────────────────────
// 점수를 탭 버튼에 표시, 다시 풀기 버튼 추가
function initQuizScores() {
  const allSecs = document.querySelectorAll('.section');
  allSecs.forEach((sec, i) => {
    const quizBlock = sec.querySelector('.quiz-block');
    if (!quizBlock) return;
    const hd = quizBlock.querySelector('.quiz-hd');
    if (!hd) return;
    const total = quizBlock.querySelectorAll('.quiz-q').length;
    if (!total) return;

    // 원본 explanation HTML 저장 (reset용)
    quizBlock.querySelectorAll('.quiz-q').forEach(q => {
      const exp = q.querySelector('.q-exp');
      if (exp) q.dataset.origExp = exp.innerHTML;
    });

    // ▸ 헤더에 다시 풀기 버튼 주입
    const resetBtn = document.createElement('button');
    resetBtn.className = 'quiz-reset-btn';
    resetBtn.textContent = '↺ 다시 풀기';
    resetBtn.title = '이 탭의 연습문제를 초기화합니다';
    resetBtn.addEventListener('click', e => {
      e.stopPropagation(); // 접기 토글 방지
      resetTabQuiz(i);
    });
    hd.appendChild(resetBtn);
  });
}

function updateQuizScore(quizQ, isCorrect) {
  const sec = quizQ.closest('.section');
  if (!sec) return;
  const secIdx = Array.from(document.querySelectorAll('.section')).indexOf(sec);

  // localStorage 저장
  const qs = sec.querySelectorAll('.quiz-q');
  const qi = Array.from(qs).indexOf(quizQ);
  if (qi >= 0) {
    const quizData = _loadRaw('pyguide_quiz') || {};
    quizData[`${secIdx}_${qi}`] = isCorrect;
    saveProgress('pyguide_quiz', quizData);
  }
  updateTabBadge(secIdx);
  updateOverallProgress();
}

// 객관식 처리
document.querySelectorAll('.quiz-q[data-correct]').forEach(q => {
  q.querySelectorAll('.opt').forEach(btn => {
    btn.addEventListener('click', () => {
      if (q.dataset.answered) return;
      q.dataset.answered = '1';
      const correct = q.dataset.correct;
      const chosen = btn.dataset.idx;
      const isOk = chosen === correct;
      q.querySelectorAll('.opt').forEach(b => {
        b.disabled = true;
        if (b.dataset.idx === correct) b.classList.add('correct');
        else if (b.dataset.idx === chosen && !isOk) b.classList.add('wrong');
      });
      const exp = q.querySelector('.q-exp');
      exp.classList.add('show', isOk ? 'ok' : 'fail');
      updateQuizScore(q, isOk);
    });
  });
});

// 주관식 처리
function checkSA(btn) {
  const q = btn.closest('.quiz-q');
  if (q.dataset.answered) return;
  const inp = q.querySelector('.sa-inp');
  const answer = q.dataset.answer.trim().toLowerCase();
  const given = inp.value.trim().toLowerCase();
  if (!given) return;
  q.dataset.answered = '1';
  inp.disabled = true;
  btn.disabled = true;
  const exp = q.querySelector('.q-exp');
  const ok = given === answer || given.replace(/\s/g,'') === answer.replace(/\s/g,'');
  if (ok) {
    inp.style.borderColor = '#1D9E75';
    inp.style.color = '#1D9E75';
    exp.innerHTML = `<strong>✅ 정답입니다!</strong> 정답: <code>${q.dataset.answer}</code>`;
    exp.classList.add('show', 'ok');
  } else {
    inp.style.borderColor = '#D85A30';
    inp.style.color = '#D85A30';
    exp.innerHTML = `<strong>❌ 오답.</strong> 정답: <code>${q.dataset.answer}</code>`;
    exp.classList.add('show', 'fail');
  }
  updateQuizScore(q, ok);
}

// Enter 키로 주관식 제출
document.querySelectorAll('.sa-inp').forEach(inp => {
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const btn = inp.closest('.sa-row').querySelector('.sa-btn');
      if (btn) checkSA(btn);
    }
  });
});

// ── ③ 코드 편집 버튼 주입 ─────────────────────────────────────────
function _extractRawCode(pre) {
  const stripped = pre.innerHTML.replace(/<[^>]+>/g, '');
  const ta = document.createElement('textarea');
  ta.innerHTML = stripped;
  return ta.value;
}

function injectEditButtons() {
  document.querySelectorAll('.run-wrap').forEach(wrap => {
    const pre = wrap.querySelector('pre');
    if (!pre || wrap.querySelector('.edit-btn')) return;

    // ── 편집 영역 래퍼 ──────────────────────────────────────────
    const editWrap = document.createElement('div');
    editWrap.className = 'edit-area-wrap';

    // 줄번호 + textarea를 감싸는 flex 컨테이너
    const liner = document.createElement('div');
    liner.className = 'edit-area-liner';

    const linenosDiv = document.createElement('div');
    linenosDiv.className = 'edit-area-linenos';
    linenosDiv.setAttribute('aria-hidden', 'true');
    linenosDiv.textContent = '1';

    const editArea = document.createElement('textarea');
    editArea.className = 'edit-area';
    editArea.spellcheck = false;
    editArea.autocomplete = 'off';
    editArea.placeholder = '코드를 자유롭게 수정하고 ▶ 실행을 눌러보세요!';

    liner.appendChild(linenosDiv);
    liner.appendChild(editArea);
    editWrap.appendChild(liner);
    wrap.insertBefore(editWrap, wrap.querySelector('.py-output'));

    // ── 줄번호 업데이트 헬퍼 ────────────────────────────────────
    function updateLinenos() {
      const lines = editArea.value.split('\n').length;
      linenosDiv.textContent = Array.from({length: lines}, (_, i) => i + 1).join('\n');
      // textarea 높이에 맞게 linenos 스크롤 동기화
      linenosDiv.scrollTop = editArea.scrollTop;
    }

    // ── Tab → 공백 4칸 ──────────────────────────────────────────
    editArea.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editArea.selectionStart;
        const end = editArea.selectionEnd;
        editArea.value = editArea.value.slice(0, start) + '    ' + editArea.value.slice(end);
        editArea.selectionStart = editArea.selectionEnd = start + 4;
        updateLinenos();
      }
    });

    editArea.addEventListener('input', () => {
      updateLinenos();
      editArea.style.height = 'auto';
      editArea.style.height = editArea.scrollHeight + 'px';
    });

    editArea.addEventListener('scroll', () => {
      linenosDiv.scrollTop = editArea.scrollTop;
    });

    // ── 초기화 버튼 ─────────────────────────────────────────────
    const resetBtn = document.createElement('button');
    resetBtn.className = 'reset-code-btn';
    resetBtn.textContent = '↺ 원본';
    resetBtn.title = '원본 코드로 되돌리기';
    resetBtn.addEventListener('click', () => {
      const original = editArea.dataset.original;
      if (original === undefined) return;
      editArea.value = original;
      // pre가 이미 plain-text로 수정된 상태라면 함께 원복
      if (pre.dataset.edited) {
        pre.textContent = original;
        delete pre.dataset.edited;
      }
      editBtn.textContent = '📄 보기';
      editBtn.classList.remove('edited');
      updateLinenos();
      editArea.style.height = 'auto';
      editArea.style.height = editArea.scrollHeight + 'px';
    });
    wrap.appendChild(resetBtn);

    // ── 편집 버튼 ───────────────────────────────────────────────
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = '✏️ 편집';
    editBtn.title = '코드를 직접 수정한 뒤 실행해보세요';
    editBtn.addEventListener('click', () => {
      const isEditing = editWrap.classList.contains('show');
      if (isEditing) {
        // 보기 모드로 전환
        const edited = editArea.value;
        const originalRaw = editArea.dataset.original || _extractRawCode(pre);
        if (edited !== originalRaw) {
          pre.textContent = edited;
          pre.dataset.edited = '1';
        } else if (pre.dataset.edited) {
          // 사용자가 원본으로 리셋 후 보기 전환 — pre도 원본으로 동기화
          pre.textContent = originalRaw;
          delete pre.dataset.edited;
        }
        editWrap.classList.remove('show');
        resetBtn.classList.remove('show');
        pre.style.display = '';
        if (pre.dataset.edited) {
          editBtn.textContent = '✏️ 수정됨';
          editBtn.classList.add('edited');
        } else {
          editBtn.textContent = '✏️ 편집';
        }
        editBtn.classList.remove('active');
      } else {
        // 편집 모드로 전환
        const rawCode = pre.dataset.edited ? pre.textContent : _extractRawCode(pre);
        editArea.value = rawCode;
        // 최초 진입 시 원본 저장
        if (editArea.dataset.original === undefined) {
          editArea.dataset.original = _extractRawCode(pre);
        }
        const preH = pre.offsetHeight;
        editArea.style.minHeight = Math.max(80, preH) + 'px';
        editWrap.classList.add('show');
        resetBtn.classList.add('show');
        pre.style.display = 'none';
        editBtn.textContent = '📄 보기';
        editBtn.classList.remove('edited');
        editBtn.classList.add('active');
        editArea.focus();
        editArea.style.height = 'auto';
        editArea.style.height = editArea.scrollHeight + 'px';
        updateLinenos();
      }
    });
    wrap.appendChild(editBtn);
  });
}

function injectCopyPreButtons() {
  document.querySelectorAll('.run-wrap').forEach(wrap => {
    const pre = wrap.querySelector('pre');
    const runBtn = wrap.querySelector('.run-btn');
    if (!pre || !runBtn || wrap.querySelector('.copy-pre-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-pre-btn';
    btn.textContent = '복사';
    btn.title = 'pre 코드 복사';
    btn.addEventListener('click', async () => {
      const text = pre.dataset.edited === '1' ? pre.textContent : _extractRawCode(pre);
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = '✓ 복사됨';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = '복사'; btn.classList.remove('copied'); }, 1500);
      } catch (err) {
        btn.textContent = '실패';
        setTimeout(() => { btn.textContent = '복사'; }, 1500);
      }
    });
    wrap.insertBefore(btn, runBtn);
  });
}

function openShortcutModal() {
  const m = document.getElementById('shortcut-modal');
  if (m) m.classList.add('open');
}
function closeShortcutModal() {
  const m = document.getElementById('shortcut-modal');
  if (m) m.classList.remove('open');
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    // 모달 열림 여부를 먼저 확인 (닫기 전에)
    const anyModalOpen = ['search-modal', 'bookmark-modal', 'storage-modal', 'shortcut-modal']
      .some(id => { const m = document.getElementById(id); return m && m.classList.contains('open'); });

    closeShortcutModal();
    closeStorageModal();

    // 모달이 열려 있었으면 터미널 토글하지 않음
    if (anyModalOpen) return;

    const termPanel = document.getElementById('py-term-panel');
    const termInput = document.getElementById('py-term-input');
    if (!termPanel) return;

    if (termPanel.classList.contains('open')) {
      // 열려있음: 입력창 포커스 중이 아닐 때만 닫기 (입력창은 자체 핸들러가 처리)
      if (document.activeElement !== termInput) {
        if (typeof window.termToggle === 'function') window.termToggle();
      }
    } else {
      // 닫혀있음: ESC로 열기
      if (typeof window.termToggle === 'function') window.termToggle();
    }
  }
});

function initProgress() {
  cleanOrphanKeys();   // 구버전 잔여 키 자동 정리
  initQuizScores();
  injectEditButtons();
  injectCopyPreButtons();
  initCollapsible();
  injectTabBadges();
  loadProgress();
}

// 초기화 (스크립트가 body 끝에 위치하므로 DOM이 이미 준비된 상태)
(function initOnReady() {
  function _init() {
    initProgress();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();

// ── ② 퀴즈 초기화 ─────────────────────────────────────────────────
function resetTabQuiz(secIdx) {
  const sec = document.querySelectorAll('.section')[secIdx];
  if (!sec) return;
  const quizBlock = sec.querySelector('.quiz-block');
  if (!quizBlock) return;

  quizBlock.querySelectorAll('.quiz-q').forEach(q => {
    delete q.dataset.answered;
    // 객관식 초기화
    q.querySelectorAll('.opt').forEach(b => {
      b.disabled = false;
      b.classList.remove('correct', 'wrong');
    });
    // 주관식 초기화
    const inp = q.querySelector('.sa-inp');
    const saBtn = q.querySelector('.sa-btn');
    if (inp) {
      inp.disabled = false;
      inp.value = '';
      inp.style.borderColor = '';
      inp.style.color = '';
    }
    if (saBtn) saBtn.disabled = false;
    // 해설 숨기기
    const exp = q.querySelector('.q-exp');
    if (exp) {
      exp.className = 'q-exp';
      exp.innerHTML = q.dataset.origExp || '';
    }
  });

  // localStorage 에서 해당 섹션 퀴즈 데이터 제거
  const quizData = _loadRaw('pyguide_quiz') || {};
  const total = quizBlock.querySelectorAll('.quiz-q').length;
  for (let qi = 0; qi < total; qi++) {
    delete quizData[`${secIdx}_${qi}`];
  }
  saveProgress('pyguide_quiz', quizData);
  updateTabBadge(secIdx);
  updateOverallProgress();
}

// ── ③ 접기/펼치기 ─────────────────────────────────────────────────
const _blockCollapseState = {};

function initCollapsible() {
  document.querySelectorAll('.section').forEach((sec, secIdx) => {

    // ── 일반 .block, .mistake-block (h3 기반, project-block 제외) ──
    sec.querySelectorAll('.block, .mistake-block').forEach((block, blockIdx) => {
      if (block.classList.contains('project-block')) return;
      const h3 = block.querySelector('h3');
      if (!h3) return;
      const key = `${secIdx}-${blockIdx}`;

      const body = document.createElement('div');
      body.className = 'block-body';
      body.dataset.key = key;
      let node = h3.nextSibling;
      while (node) {
        const next = node.nextSibling;
        body.appendChild(node);
        node = next;
      }
      block.appendChild(body);

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'block-toggle';
      toggleBtn.innerHTML = '&#9654;';
      toggleBtn.title = '접기 / 펼치기';
      h3.appendChild(toggleBtn);

      h3.addEventListener('click', (e) => {
        if (e.target.classList.contains('quiz-reset-btn')) return;
        if (e.target.closest('.bookmark-pin-btn')) return;
        _toggleBlock(key, body, toggleBtn);
      });
    });

    // ── 미니 프로젝트 블록 (.project-hd 기반) ─────────────────────
    sec.querySelectorAll('.project-block').forEach((block) => {
      const hd = block.querySelector('.project-hd');
      if (!hd || hd.querySelector('.block-toggle')) return;

      const allBlocks = Array.from(sec.querySelectorAll('.block, .mistake-block'));
      const blockIdx = allBlocks.indexOf(block);
      const key = `${secIdx}-${blockIdx}`;

      hd.style.cursor = 'pointer';
      hd.style.userSelect = 'none';
      hd.style.display = 'flex';
      hd.style.alignItems = 'center';

      const body = document.createElement('div');
      body.className = 'block-body';
      body.dataset.key = key;
      let node = hd.nextSibling;
      while (node) {
        const next = node.nextSibling;
        body.appendChild(node);
        node = next;
      }
      block.appendChild(body);

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'block-toggle';
      toggleBtn.style.color = 'inherit';
      toggleBtn.style.opacity = '0.7';
      toggleBtn.innerHTML = '&#9654;';
      toggleBtn.title = '접기 / 펼치기';
      hd.appendChild(toggleBtn);

      hd.addEventListener('click', (e) => {
        if (e.target.closest('.bookmark-pin-btn')) return;
        _toggleBlock(key, body, toggleBtn);
      });
    });
  });
}

function _toggleBlock(key, body, btn) {
  const collapsed = !(_blockCollapseState[key] || false);
  _blockCollapseState[key] = collapsed;
  body.classList.toggle('collapsed', collapsed);
  btn.classList.toggle('is-collapsed', collapsed);
  // localStorage 저장
  const blockData = _loadRaw('pyguide_blocks') || {};
  blockData[key] = collapsed;
  saveProgress('pyguide_blocks', blockData);
}

function collapseAllBlocks() {
  const activeSec = document.querySelector('.section.on');
  if (!activeSec) return;
  const blockData = _loadRaw('pyguide_blocks') || {};
  activeSec.querySelectorAll('.block-body').forEach(body => {
    const key = body.dataset.key;
    if (key) { _blockCollapseState[key] = true; blockData[key] = true; }
    body.classList.add('collapsed');
  });
  activeSec.querySelectorAll('.block-toggle').forEach(btn => btn.classList.add('is-collapsed'));
  saveProgress('pyguide_blocks', blockData);
}

function expandAllBlocks() {
  const activeSec = document.querySelector('.section.on');
  if (!activeSec) return;
  const blockData = _loadRaw('pyguide_blocks') || {};
  activeSec.querySelectorAll('.block-body').forEach(body => {
    const key = body.dataset.key;
    if (key) { _blockCollapseState[key] = false; blockData[key] = false; }
    body.classList.remove('collapsed');
  });
  activeSec.querySelectorAll('.block-toggle').forEach(btn => btn.classList.remove('is-collapsed'));
  saveProgress('pyguide_blocks', blockData);
}

// ══════════════════════════════════════════════════════════════════
//  코드 챌린지 실행 & 채점
// ══════════════════════════════════════════════════════════════════

window.challengeRun = async function(btn) {
  if (!window._pyodideRef) {
    alert('파이썬 환경이 아직 로딩 중입니다. 잠시 후 다시 시도하세요.');
    return;
  }
  const item = btn.closest('.challenge-item');
  const ta = item.querySelector('.edit-area');
  const out = item.querySelector('.challenge-output');
  const code = ta.value;

  btn.disabled = true;
  btn.textContent = '⏳ 실행 중…';
  out.textContent = '';
  out.className = 'challenge-output';

  try {
    window._pyodideRef.globals.set('_src', code);
    const stdout = window._pyodideRef.runPython('_run(_src)');
    out.textContent = stdout && stdout.trim() ? stdout.trimEnd() : '(출력 없음)';
    out.classList.add('show');
  } catch (err) {
    let msg = err.message || String(err);
    if (msg.startsWith('PythonError: ')) msg = msg.slice(13);
    out.textContent = msg;
    out.classList.add('show', 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '▶ 실행';
  }
};

window.challengeGrade = async function(btn) {
  if (!window._pyodideRef) {
    alert('파이썬 환경이 아직 로딩 중입니다. 잠시 후 다시 시도하세요.');
    return;
  }
  const item = btn.closest('.challenge-item');
  const ta = item.querySelector('.edit-area');
  const result = item.querySelector('.challenge-result');
  const expected = (ta.dataset.expected || '').trim();
  const code = ta.value;

  btn.disabled = true;
  btn.textContent = '⏳ 채점 중…';
  result.textContent = '';
  result.className = 'challenge-result';

  try {
    window._pyodideRef.globals.set('_src', code);
    const stdout = window._pyodideRef.runPython('_run(_src)');
    const actual = (stdout || '').trimEnd();
    const ok = actual.trim() === expected.trim();
    result.textContent = ok
      ? `✅ 정답! 출력이 일치합니다.`
      : `❌ 오답. 예상: "${expected}" / 실제: "${actual}"`;
    result.classList.add(ok ? 'pass' : 'fail');
  } catch (err) {
    let msg = err.message || String(err);
    if (msg.startsWith('PythonError: ')) msg = msg.slice(13);
    result.textContent = `❌ 오류 발생: ${msg.split('\n').pop() || msg}`;
    result.classList.add('fail');
  } finally {
    btn.disabled = false;
    btn.textContent = '✔ 채점';
  }
};

// ═══════════════════════════════════════════════════════════════
//  Pyodide 로더 & 인터랙티브 실행 엔진  (자동 삽입 — 편집 금지)
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const CDN = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/';

  // ── 상태 바 헬퍼 ────────────────────────────────────────────
  function setBar(cls, ico, txt) {
    const bar = document.getElementById('py-bar');
    const iEl = document.getElementById('py-ico');
    const tEl = document.getElementById('py-txt');
    if (!bar) return;
    bar.className = cls;
    iEl.textContent = ico;
    tEl.textContent = txt;
    if (cls === 'ready') {
      const legend = document.getElementById('py-bar-legend');
      if (legend) legend.style.display = 'flex';
    }
  }

  // ── Pyodide 스크립트를 CDN에서 동적 로드 ────────────────────
  let pyodide = null;
  const sc = document.createElement('script');

  sc.onload = async () => {
    try {
      pyodide = await loadPyodide({ indexURL: CDN });

      // ── 자동-출력 헬퍼(_run) + 영속 네임스페이스(_ns) 초기화 ──
      // Python 코드를 backtick template literal로 전달
      // (Python 코드 안에 backtick이 없으므로 이스케이프 불필요)
      pyodide.runPython(
`import ast, sys, io

_ns = {}   # 세션 영속 네임스페이스 (탭 닫으면 초기화)

# ── input() → 브라우저 prompt() 연결 ──────────────────────────
import builtins as _bi, js as _js
def _input_fn(prompt_text=''):
    val = _js.window.prompt(str(prompt_text) if prompt_text else '')
    if val is None:          # 사용자가 취소 버튼 누름
        raise EOFError('입력이 취소되었습니다')
    return val
_bi.input = _input_fn        # 전역 input() 교체

# ── exit()/quit() → 친화적 메시지로 처리 ─────────────────────
def _exit_fn(*a, **k):
    raise SystemExit('터미널에서는 exit()를 사용할 수 없습니다.')
_bi.exit = _exit_fn
_bi.quit = _exit_fn

def _run(src):
    # ast로 구문 단위 분리 → 표현식은 결과값을 자동 출력
    tree = ast.parse(src)
    buf  = io.StringIO()
    old  = sys.stdout
    sys.stdout = buf
    try:
        for node in tree.body:
            if isinstance(node, ast.Expr):
                # 표현식: 값을 캡처한 뒤 None이 아니면 출력
                asgn = ast.Assign(
                    targets=[ast.Name(id='_pyo_v_', ctx=ast.Store())],
                    value=node.value
                )
                ast.fix_missing_locations(asgn)
                exec(
                    compile(ast.Module(body=[asgn], type_ignores=[]),
                            '<cell>', 'exec'),
                    _ns
                )
                v = _ns.get('_pyo_v_')
                if v is not None:
                    print(repr(v))
            else:
                # 일반 구문(import / def / class / if / for 등)
                mod = ast.Module(body=[node], type_ignores=[])
                ast.fix_missing_locations(mod)
                exec(compile(mod, '<cell>', 'exec'), _ns)
    finally:
        sys.stdout = old
    return buf.getvalue()
`
      );

      window._pyodideRef = pyodide;  // 터미널에서 공유
      setBar('ready', '✅', '파이썬 실행 환경 준비 완료');
      document.querySelectorAll('.run-btn').forEach(b => { b.disabled = false; });

    } catch (e) {
      setBar('fail', '❌', '파이썬 환경 로드 실패: ' + e.message);
    }
  };

  sc.onerror = () =>
    setBar('fail', '❌', 'Pyodide CDN을 불러오지 못했습니다. 인터넷 연결을 확인하세요.');

  // src는 onload/onerror 핸들러 등록 후 마지막에 설정 (레이스 컨디션 방지)
  sc.src = CDN + 'pyodide.js';
  document.head.appendChild(sc);

  // ── HTML → 순수 파이썬 코드 추출 ────────────────────────────
  // 1) <span class="…">…</span> 태그 제거
  // 2) &lt; &gt; &amp; 등 HTML 엔티티를 실제 문자로 디코딩
  function extractCode(pre) {
    // 편집된 경우 pre.textContent가 plain text로 저장됨
    if (pre.dataset.edited) return pre.textContent;
    const stripped = pre.innerHTML.replace(/<[^>]+>/g, '');
    const ta = document.createElement('textarea');
    ta.innerHTML = stripped;
    return ta.value;
  }

  // ── ▶ 실행 버튼 클릭 핸들러 ─────────────────────────────────
  window.runCode = async function (btn) {
    if (!pyodide) {
      alert('파이썬 환경이 아직 로딩 중입니다. 잠시 후 다시 시도하세요.');
      return;
    }

    const wrap = btn.closest('.run-wrap');
    const pre  = wrap.querySelector('pre');
    const out  = wrap.querySelector('.py-output');
    const editWrap = wrap.querySelector('.edit-area-wrap');
    const editArea = wrap.querySelector('.edit-area');
    // 편집 모드면 textarea 내용을, 아니면 pre의 코드를 사용
    const isEditMode = editWrap && editWrap.classList.contains('show');
    const code = isEditMode ? editArea.value : extractCode(pre);

    // 실행 중 UI
    btn.disabled    = true;
    btn.classList.add('spinning');
    btn.textContent = '⏳ 실행 중…';
    out.className   = 'py-output';   // 이전 결과 초기화
    out.textContent = '';

    try {
      // JS → Python으로 코드 문자열 전달 (globals 이용)
      pyodide.globals.set('_src', code);
      const stdout = pyodide.runPython('_run(_src)');

      if (stdout && stdout.trim()) {
        out.textContent = stdout.trimEnd();
        out.classList.add('show');
      } else {
        out.textContent = '(출력 없음 — 코드가 오류 없이 실행되었습니다)';
        out.classList.add('show', 'muted');
      }
    } catch (err) {
      // PythonError 접두사 제거 후 traceback 표시
      let msg = err.message || String(err);
      if (msg.startsWith('PythonError: ')) msg = msg.slice(13);
      // SystemExit(exit/quit 호출)는 오류 스타일이 아닌 안내 메시지로
      if (msg.includes('SystemExit') || msg.includes('터미널에서는')) {
        out.textContent = msg.replace(/^SystemExit:\s*/, '');
        out.classList.add('show', 'muted');
      } else {
        const lines = msg.trimEnd().split('\n');
        if (lines.length > 2) {
          // 멀티라인 traceback → 접기/펼치기
          out.classList.add('show', 'err');
          const tbWrap = document.createElement('div');
          tbWrap.className = 'tb-wrap';
          const toggleBtn = document.createElement('button');
          toggleBtn.className = 'tb-toggle-btn';
          toggleBtn.textContent = '▶ traceback 펼치기 (' + (lines.length - 1) + '줄)';
          const detail = document.createElement('div');
          detail.className = 'tb-detail';
          detail.textContent = lines.slice(0, -1).join('\n');
          toggleBtn.addEventListener('click', () => {
            const open = detail.classList.toggle('open');
            toggleBtn.textContent = open
              ? '▼ traceback 접기'
              : '▶ traceback 펼치기 (' + (lines.length - 1) + '줄)';
          });
          const lastDiv = document.createElement('div');
          lastDiv.className = 'tb-last';
          lastDiv.textContent = lines[lines.length - 1];
          tbWrap.appendChild(toggleBtn);
          tbWrap.appendChild(detail);
          tbWrap.appendChild(lastDiv);
          out.appendChild(tbWrap);
        } else {
          out.textContent = msg;
          out.classList.add('show', 'err');
        }
      }
    } finally {
      btn.disabled    = false;
      btn.classList.remove('spinning');
      btn.textContent = '▶ 실행';
    }
  };

})();


// ══════════════════════════════════════════════════════════════════
//  Python 터미널 패널
// ══════════════════════════════════════════════════════════════════
(function () {
  const outputEl   = () => document.getElementById('py-term-output');
  const inputEl    = () => document.getElementById('py-term-input');
  const runBtnEl   = () => document.getElementById('py-term-run-btn');
  const promptEl   = () => document.getElementById('py-term-prompt');
  const dotEl      = () => document.getElementById('py-term-dot');
  const toggleDot  = () => document.getElementById('py-term-toggle-dot');
  const toggleBtn  = () => document.getElementById('py-term-toggle');
  const panel      = () => document.getElementById('py-term-panel');
  const intBtn     = () => document.getElementById('py-term-interrupt-btn');

  let history   = [];   // 입력 히스토리 (메모리에만 저장)
  let histIdx   = -1;
  let pendingML = '';   // 멀티라인 누적 버퍼
  let isML      = false;
  let _isRunning = false;

  // ── 인터럽트 버퍼 (SharedArrayBuffer 지원 시) ────────────────
  let _interruptBuf = null;
  try {
    if (typeof SharedArrayBuffer !== 'undefined') {
      _interruptBuf = new Uint8Array(new SharedArrayBuffer(4));
    }
  } catch(e) {}

  window.termInterrupt = function() {
    if (_interruptBuf) {
      _interruptBuf[0] = 2; // SIGINT
      termPrint('(실행 중단 신호를 보냈습니다)', 'term-line-sys');
    } else {
      termPrint('⚠ 인터럽트를 지원하지 않는 환경입니다. 무한루프 발생 시 페이지를 새로 고침하세요.', 'term-line-sys');
    }
  };

  // ── 터미널 출력 헬퍼 ─────────────────────────────────────────
  function termPrint(text, cls) {
    const out = outputEl();
    if (!out) return;
    const div = document.createElement('div');
    div.className = cls || 'term-line-out';
    div.textContent = text;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  }

  // ── 에러 traceback 토글 출력 ─────────────────────────────────
  function termPrintError(msg) {
    const out = outputEl();
    if (!out) return;
    const lines = msg.trimEnd().split('\n');
    if (lines.length <= 2) {
      lines.forEach(l => termPrint(l, 'term-line-err'));
      return;
    }
    const container = document.createElement('div');
    container.className = 'term-tb-container';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'term-tb-toggle';
    toggleBtn.textContent = '▶ traceback 펼치기 (' + (lines.length - 1) + '줄)';

    const detail = document.createElement('div');
    detail.className = 'term-tb-detail';
    lines.slice(0, -1).forEach(l => {
      const d = document.createElement('div');
      d.className = 'term-line-err';
      d.textContent = l;
      detail.appendChild(d);
    });

    toggleBtn.addEventListener('click', () => {
      const open = detail.classList.toggle('open');
      toggleBtn.textContent = open
        ? '▼ traceback 접기'
        : '▶ traceback 펼치기 (' + (lines.length - 1) + '줄)';
    });

    const lastDiv = document.createElement('div');
    lastDiv.className = 'term-line-err';
    lastDiv.style.fontWeight = '500';
    lastDiv.textContent = lines[lines.length - 1];

    container.appendChild(toggleBtn);
    container.appendChild(detail);
    container.appendChild(lastDiv);
    out.appendChild(container);
    out.scrollTop = out.scrollHeight;
  }

  function termPrintPromptLine(code) {
    const prefix = isML ? '... ' : '>>> ';
    termPrint(prefix + code, 'term-line-in');
  }

  // ── 실행 중 UI 상태 관리 ─────────────────────────────────────
  function setRunning(running) {
    _isRunning = running;
    const ib = intBtn();
    if (ib) ib.classList.toggle('visible', running);
    const rb = runBtnEl();
    if (rb) rb.disabled = running;
  }

  // ── Pyodide 준비 완료 시 터미널 활성화 ───────────────────────
  function activateTerminal(py) {
    const rb   = runBtnEl();
    const dot  = dotEl();
    const tdot = toggleDot();
    if (rb)   rb.disabled = false;
    if (dot)  { dot.classList.remove('off'); dot.style.background = '#1D9E75'; }
    if (tdot) tdot.style.background = '#1D9E75';

    // 인터럽트 버퍼 등록
    if (_interruptBuf && py.setInterruptBuffer) {
      try { py.setInterruptBuffer(_interruptBuf); } catch(e) {}
    }

    // 환영 메시지
    try {
      const ver = py.runPython('import sys; sys.version.split()[0]');
      termPrint(`Python ${ver} (Pyodide v0.29.3) — 코드를 입력하고 Enter를 누르세요.`, 'term-line-sys');
      termPrint('Tip: Shift+Enter=멀티라인 | 빈 줄=실행 | Esc=취소 | ↑↓=히스토리 | Tab=들여쓰기 | clear()=초기화', 'term-line-sys');
    } catch(e) {
      termPrint('Python 터미널 준비 완료', 'term-line-sys');
    }
  }

  // ── Pyodide 로드 완료 감지 (MutationObserver) ─────────────────
  function onBarReady() {
    setTimeout(() => {
      const py = window._pyodideRef;
      if (py) {
        activateTerminal(py);
      } else {
        const rb = runBtnEl();
        if (rb) rb.disabled = false;
        termPrint('Python 터미널 준비 완료 (Pyodide)', 'term-line-sys');
        const dot = dotEl();
        if (dot) { dot.classList.remove('off'); dot.style.background = '#1D9E75'; }
        const tdot = toggleDot();
        if (tdot) tdot.style.background = '#1D9E75';
      }
    }, 100);
  }

  const barEl = document.getElementById('py-bar');
  const barObserver = new MutationObserver(() => {
    if (barEl && barEl.classList.contains('ready')) {
      barObserver.disconnect();
      onBarReady();
    }
  });
  if (barEl) {
    barObserver.observe(barEl, { attributes: true, attributeFilter: ['class'] });
    if (barEl.classList.contains('ready')) {
      barObserver.disconnect();
      onBarReady();
    }
  }

  // ── 터미널 열기/닫기 ─────────────────────────────────────────
  window.termToggle = function () {
    const p   = panel();
    const btn = toggleBtn();
    const isOpen = p.classList.toggle('open');
    btn.classList.toggle('open', isOpen);
    document.body.style.paddingBottom = isOpen ? '276px' : '';
    if (isOpen) { inputEl().focus(); }
  };

  // ── 출력 초기화 ──────────────────────────────────────────────
  window.termClear = function () {
    const out = outputEl();
    if (out) out.innerHTML = '';
  };

  // ── 코드 실행 ────────────────────────────────────────────────
  window.termRun = async function () {
    const inp    = inputEl();
    const prompt = promptEl();
    if (!inp) return;

    const line = inp.value;
    // clear() 단축 명령
    if (line.trim() === 'clear()') {
      termClear();
      inp.value = '';
      autoResize(inp);
      return;
    }

    // 멀티라인 모드 처리
    if (isML) {
      termPrintPromptLine(line);
      if (line.trim() === '') {
        isML = false;
        prompt.textContent = '>>> ';
        const code = pendingML;
        pendingML = '';
        inp.value = '';
        autoResize(inp);
        await execCode(code);
        return;
      } else {
        pendingML += '\n' + line;
        inp.value = '';
        autoResize(inp);
        return;
      }
    }

    // 멀티라인 시작 감지 (콜론으로 끝나는 줄)
    if (line.trim().endsWith(':') || line.trim().endsWith('\\') ||
        line.trim().startsWith('def ') || line.trim().startsWith('class ') ||
        line.trim().startsWith('if ') || line.trim().startsWith('for ') ||
        line.trim().startsWith('while ') || line.trim().startsWith('with ') ||
        line.trim().startsWith('try') || line.trim().startsWith('elif') ||
        line.trim().startsWith('else') || line.trim().startsWith('finally')) {
      if (line.trim().endsWith(':') || line.trim().endsWith('\\')) {
        termPrintPromptLine(line);
        isML = true;
        pendingML = line;
        prompt.textContent = '... ';
        inp.value = '';
        autoResize(inp);
        if (line.trim()) { history.unshift(line); histIdx = -1; }
        return;
      }
    }

    if (line.trim()) {
      history.unshift(line);
      histIdx = -1;
    }
    termPrintPromptLine(line);
    inp.value = '';
    autoResize(inp);
    await execCode(line);
  };

  async function execCode(code) {
    if (!code.trim()) return;
    setRunning(true);
    // 인터럽트 버퍼 초기화
    if (_interruptBuf) _interruptBuf[0] = 0;

    try {
      const pyodide = window._pyodideRef;
      if (!pyodide) {
        termPrint('파이썬 환경이 아직 준비되지 않았습니다.', 'term-line-err');
        return;
      }
      pyodide.globals.set('_src', code);
      const stdout = pyodide.runPython('_run(_src)');
      if (stdout && stdout.trim()) {
        stdout.trimEnd().split('\n').forEach(l => termPrint(l, 'term-line-out'));
      }
    } catch (err) {
      let msg = err.message || String(err);
      if (msg.startsWith('PythonError: ')) msg = msg.slice(13);
      if (msg.includes('SystemExit') || msg.includes('터미널에서는')) {
        termPrint(msg.replace(/^SystemExit:\s*/, ''), 'term-line-sys');
      } else {
        termPrintError(msg);
      }
    } finally {
      setRunning(false);
      inputEl().focus();
    }
  }

  // ── 입력창 이벤트 ────────────────────────────────────────────
  function autoResize(el) {
    el.style.height = '22px';
    el.style.height = Math.max(22, el.scrollHeight) + 'px';
  }

  function bindInputEvents() {
    const inp = inputEl();
    if (!inp) return;

    inp.addEventListener('input', () => autoResize(inp));

    inp.addEventListener('keydown', e => {
      // Tab → 공백 4칸
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = inp.selectionStart;
        const end = inp.selectionEnd;
        inp.value = inp.value.slice(0, start) + '    ' + inp.value.slice(end);
        inp.selectionStart = inp.selectionEnd = start + 4;
        autoResize(inp);
        return;
      }
      // Escape: 터미널 닫기 (멀티라인 상태 유지 — 다시 열면 이어서 입력 가능)
      if (e.key === 'Escape') {
        e.preventDefault();
        if (typeof window.termToggle === 'function') window.termToggle();
        return;
      }
      // Enter: 실행 / Shift+Enter: 줄바꿈
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        termRun();
        return;
      }
      // ↑: 히스토리 이전
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (histIdx < history.length - 1) {
          histIdx++;
          inp.value = history[histIdx];
          autoResize(inp);
          setTimeout(() => inp.setSelectionRange(inp.value.length, inp.value.length), 0);
        }
        return;
      }
      // ↓: 히스토리 다음
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (histIdx > 0) {
          histIdx--;
          inp.value = history[histIdx];
        } else {
          histIdx = -1;
          inp.value = '';
        }
        autoResize(inp);
        return;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindInputEvents);
  } else {
    bindInputEvents();
  }
})();


// ═══════════════════════════════════════════════════════════════
// ② 다크모드 / 전체검색 / 폰트크기
// ═══════════════════════════════════════════════════════════════

/* ■■■ 광고 비활성화 구간 시작 — 광고 심사 승인 후 아래 주석 해제할 것 ■■■
// ── 광고 배너 / 팝업 ─────────────────────────────────────────────
// function closeAdBanner() {
//   document.getElementById('ad-banner').style.display = 'none';
//   document.body.classList.remove('ad-open');
// }
// function closeWelcome() {
//   document.getElementById('welcome-popup').style.display = 'none';
//   document.getElementById('welcome-overlay').style.display = 'none';
// }
// function dismissForToday() {
//   localStorage.setItem('popup_dismissed', new Date().toDateString());
//   closeWelcome();
// }
// (function() {
//   document.body.classList.add('ad-open');
//   const dismissed = localStorage.getItem('popup_dismissed');
//   if (dismissed !== new Date().toDateString()) {
//     document.getElementById('welcome-popup').style.display = 'block';
//     document.getElementById('welcome-overlay').style.display = 'block';
//   }
// })();
■■■ 광고 비활성화 구간 끝 ■■■ */

// ══════════════════════════════════════════════════════════════════
// ① 다크/라이트 모드 토글
// ══════════════════════════════════════════════════════════════════
(function initDarkMode() {
  const KEY = 'pyguide_dark';
  const btn = document.getElementById('dark-toggle-btn');

  function applyDark(isDark) {
    document.body.classList.toggle('dark', isDark);
    // 아이콘: "클릭하면 이 모드로 전환" 관례 — 다크 중이면 ☀️(라이트로), 라이트 중이면 🌙(다크로)
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';
  }

  // 초기값: localStorage 우선, 없으면 시스템 설정
  let stored = localStorage.getItem(KEY);
  let isDark;
  if (stored !== null) {
    isDark = stored === '1';
  } else {
    isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  applyDark(isDark);

  // 시스템 다크모드 변경 감지 (사용자가 직접 설정하지 않은 경우만)
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (localStorage.getItem(KEY) === null) applyDark(e.matches);
    });
  }

  window.toggleDarkMode = function() {
    const now = !document.body.classList.contains('dark');
    applyDark(now);
    localStorage.setItem(KEY, now ? '1' : '0');
  };
})();

// ══════════════════════════════════════════════════════════════════
// ② 전체 검색 (Ctrl+K)
// ══════════════════════════════════════════════════════════════════
(function initSearch() {
  const tabMeta = Array.from(document.querySelectorAll('.tab')).map(t => {
    const name = t.childNodes[0] && t.childNodes[0].nodeType === 3
      ? t.childNodes[0].textContent.trim()
      : t.textContent.trim().replace(/완료\s*\d+\/\d+/, '').trim();
    const imp = t.getAttribute('data-imp') || '';
    return { name, imp };
  });
  const tabNames = tabMeta.map(m => m.name);

  // 검색 인덱스 빌드: 각 블록별 {tabIdx, tabName, title, desc, code, el, blockEl}
  function buildIndex() {
    const idx = [];
    document.querySelectorAll('.section').forEach((sec, si) => {
      const tabName = tabNames[si] || `탭 ${si + 1}`;
      const tabImp  = (tabMeta[si] || {}).imp || "";
      // 일반 .block, .intro-block, .mistake-block 포함
      sec.querySelectorAll('.block, .intro-block, .mistake-block').forEach(block => {
        const h3 = block.querySelector('h3');
        const titleText = h3 ? h3.textContent.replace(/[▶▼📌]/g, '').replace(/\s+/g,' ').trim()
          : (block.querySelector('.project-hd') ? block.querySelector('.project-hd').textContent.replace(/[▶▼📌▶]/g,'').replace(/\s+/g,' ').trim() : '');
        // .desc / .intro-desc / .mistake-desc / .challenge-desc 등
        const descEl = block.querySelector('.desc, .intro-desc, .mistake-desc, .challenge-desc, .beginner-note-body');
        const descText = descEl ? descEl.textContent.trim() : '';
        // pre 코드
        const preEl = block.querySelector('pre');
        const codeText = preEl ? preEl.textContent.trim() : '';
        idx.push({ si, tabName, tabImp, title: titleText, desc: descText, code: codeText, blockEl: block });
      });
    });
    return idx;
  }

  let _index = null;
  function getIndex() {
    if (!_index) _index = buildIndex();
    return _index;
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlight(text, q) {
    if (!q) return _esc(text);
    return _esc(text).replace(new RegExp(escapeRe(_esc(q)), 'gi'), m => `<mark>${m}</mark>`);
  }

  function _esc(s) {
    const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
  }

  function doSearch(q) {
    const results = document.getElementById('search-results');
    const countEl = document.getElementById('search-count');
    q = q.trim();
    if (!q) {
      results.innerHTML = '<div class="search-empty">검색어를 입력하면 전체 탭에서 관련 항목을 찾아드립니다.</div>';
      countEl.style.display = 'none';
      return;
    }
    const idx = getIndex();
    const ql = q.toLowerCase();
    const matched = idx.filter(item =>
      item.title.toLowerCase().includes(ql) ||
      item.desc.toLowerCase().includes(ql) ||
      item.code.toLowerCase().includes(ql)
    );

    if (!matched.length) {
      results.innerHTML = `<div class="search-empty">「${_esc(q)}」에 대한 결과가 없습니다.</div>`;
      countEl.style.display = 'none';
      return;
    }

    results.innerHTML = matched.map((item, i) => {
      // 스니펫: 매칭된 위치 주변 텍스트
      let snippet = '';
      const targets = [
        { text: item.desc, label: '' },
        { text: item.code, label: '[코드] ' }
      ];
      for (const t of targets) {
        const li = t.text.toLowerCase().indexOf(ql);
        if (li >= 0) {
          const start = Math.max(0, li - 20);
          const raw = (start > 0 ? '…' : '') + t.text.slice(start, li + q.length + 40) + (li + q.length + 40 < t.text.length ? '…' : '');
          snippet = t.label + raw;
          break;
        }
      }

      // data-idx만 사용, onclick 인라인 없음 (이벤트 위임으로 처리)
      return `<button class="search-result-item" data-idx="${i}">
  <span class="sri-tab${item.tabImp ? ' sri-tab-' + item.tabImp : ''}">${_esc(item.tabName)}</span>
  <span class="sri-body">
    <span class="sri-title">${highlight(item.title || '(제목 없음)', q)}</span>
    ${snippet ? `<span class="sri-snippet">${highlight(snippet, q)}</span>` : ''}
  </span>
</button>`;
    }).join('');

    countEl.textContent = `${matched.length}개 항목 발견`;
    countEl.style.display = 'block';

    // 결과 데이터 저장 (이벤트 위임에서 사용)
    window._searchMatched = matched;
  }

  window.openSearch = function() {
    const m = document.getElementById('search-modal');
    if (!m) return;
    m.classList.add('open');
    const inp = document.getElementById('search-input');
    if (inp) { inp.value = ''; inp.focus(); }
    const results = document.getElementById('search-results');
    if (results) results.innerHTML = '<div class="search-empty">검색어를 입력하면 전체 탭에서 관련 항목을 찾아드립니다.</div>';
    document.getElementById('search-count').style.display = 'none';
  };

  window.closeSearch = function() {
    document.getElementById('search-modal').classList.remove('open');
  };

  // ── 검색 결과 이벤트 위임 (렌더링 후 동적 버튼에도 동작) ───────
  const resultsContainer = document.getElementById('search-results');
  if (resultsContainer) {
    resultsContainer.addEventListener('click', e => {
      const btn = e.target.closest('.search-result-item');
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx, 10);
      const matched = window._searchMatched;
      if (!matched || !matched[idx]) return;
      const item = matched[idx];
      closeSearch();
      go(item.si);
      // 블록 펼치기
      const body = item.blockEl.querySelector('.block-body');
      if (body && body.classList.contains('collapsed')) {
        body.classList.remove('collapsed');
        const toggle = item.blockEl.querySelector('.block-toggle');
        if (toggle) toggle.classList.remove('is-collapsed');
      }
      // 스크롤 + 하이라이트
      setTimeout(() => {
        item.blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        item.blockEl.classList.add('search-highlight');
        setTimeout(() => item.blockEl.classList.remove('search-highlight'), 1800);
      }, 80);
    });
  }

  // ── 검색 입력 이벤트 (DOMContentLoaded 불필요 — 스크립트가 body 끝에 위치) ──
  const inp = document.getElementById('search-input');
  if (inp) {
    let timer;
    inp.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => doSearch(inp.value), 150);
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = document.querySelector('#search-results .search-result-item');
        if (first) first.click();
      }
    });
  }

  // Ctrl+K 단축키
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const m = document.getElementById('search-modal');
      if (m && m.classList.contains('open')) closeSearch();
      else openSearch();
    }
    if (e.key === 'Escape') {
      const m = document.getElementById('search-modal');
      if (m && m.classList.contains('open')) closeSearch();
    }
  });
})();

// ══════════════════════════════════════════════════════════════════
// ③ 폰트 크기 조절 (±3단계, 1px씩)
// ══════════════════════════════════════════════════════════════════
(function initFontSize() {
  const KEY = 'pyguide_fslevel';
  const MIN = -3, MAX = 3;
  let level = parseInt(localStorage.getItem(KEY) || '0');

  const styleEl = document.createElement('style');
  styleEl.id = 'fz-override';
  document.head.appendChild(styleEl);

  function applyFontSize() {
    const base = 13 + level;
    const code = 12.5 + level;
    styleEl.textContent = level === 0 ? '' : `
      .desc,.mistake-desc,.intro-desc,.challenge-desc,
      .q-text,.opt,.roadmap-item,.intro-highlight,.project-hint,
      .deep-note-body,.beginner-note-body { font-size: ${base}px !important; }
      pre,.edit-area,.sa-inp,.py-output,#py-term-output,#py-term-input,
      .challenge-textarea,.challenge-output,.mtable td,.intro-table td { font-size: ${code}px !important; }
    `;
    // 뱃지 & 버튼 상태
    const badge = document.getElementById('fz-level-badge');
    if (badge) badge.textContent = level === 0 ? '기본' : (level > 0 ? `+${level}` : `${level}`);
    const upBtn = document.getElementById('fz-up-btn');
    const dnBtn = document.getElementById('fz-dn-btn');
    if (upBtn) upBtn.disabled = level >= MAX;
    if (dnBtn) dnBtn.disabled = level <= MIN;
    // 기본값(0)은 저장하지 않고 키 자체를 제거
    if (level === 0) { localStorage.removeItem(KEY); }
    else { localStorage.setItem(KEY, level); }
  }

  window.changeFontSize = function(delta) {
    level = Math.max(MIN, Math.min(MAX, level + delta));
    applyFontSize();
  };

  window.resetFontSize = function() {
    level = 0;
    applyFontSize();
  };

  // 배지 클릭 → 초기화
  const badge = document.getElementById('fz-level-badge');
  if (badge) badge.addEventListener('click', window.resetFontSize);

  applyFontSize();
})();

// ═══════════════════════════════════════════════════════════════
// ③ 북마크 / 목차 사이드바
// ═══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// ⑤ 북마크 기능
// ══════════════════════════════════════════════════════════════════
(function initBookmarks() {
  const BM_KEY = 'pyguide_bm';

  // ── 저장/불러오기 ─────────────────────────────────────────────
  function loadBookmarks() {
    try { return JSON.parse(localStorage.getItem(BM_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveBookmarks(bm) {
    localStorage.setItem(BM_KEY, JSON.stringify(bm));
  }

  // ── 북마크 키: "탭인덱스_블록인덱스" ─────────────────────────
  function getBlockKey(blockEl) {
    const sec = blockEl.closest('.section');
    if (!sec) return null;
    const secs = Array.from(document.querySelectorAll('.section'));
    const si = secs.indexOf(sec);
    const blocks = Array.from(sec.querySelectorAll('.block, .intro-block, .mistake-block'));
    const bi = blocks.indexOf(blockEl);
    if (si < 0 || bi < 0) return null;
    return `${si}_${bi}`;
  }

  // ── 블록 제목 가져오기 ────────────────────────────────────────
  function getBlockTitle(blockEl) {
    const h3 = blockEl.querySelector('h3');
    if (!h3) return '(제목 없음)';
    return h3.textContent.replace(/[▶▼📌]/g, '').replace(/\s+/g, ' ').trim();
  }

  // ── 탭 이름 가져오기 ─────────────────────────────────────────
  function getTabName(si) {
    const tabs = document.querySelectorAll('.tab');
    const t = tabs[si];
    if (!t) return `탭 ${si + 1}`;
    return t.childNodes[0] && t.childNodes[0].nodeType === 3
      ? t.childNodes[0].textContent.trim()
      : t.textContent.trim().replace(/완료\s*\d+\/\d+/, '').trim();
  }

  // ── 카운트 배지 업데이트 ──────────────────────────────────────
  function updateBadge() {
    const bm = loadBookmarks();
    const count = Object.keys(bm).length;
    const badge = document.getElementById('bm-count-badge');
    const btn = document.getElementById('bookmark-view-btn');
    if (badge) badge.textContent = count;
    if (btn) btn.classList.toggle('has-bookmarks', count > 0);
  }

  // ── 블록에 pin 버튼 추가 ──────────────────────────────────────
  function addPinButtons() {
    document.querySelectorAll('.block, .intro-block, .mistake-block').forEach(blockEl => {
      const h3 = blockEl.querySelector('h3');
      if (!h3 || h3.querySelector('.bookmark-pin-btn')) return;

      const pin = document.createElement('button');
      pin.className = 'bookmark-pin-btn';
      pin.title = '북마크 추가/제거';
      pin.setAttribute('aria-label', '북마크 토글');
      pin.textContent = '📌';
      pin.addEventListener('click', e => {
        e.stopPropagation();
        toggleBookmark(blockEl, pin);
      });
      h3.appendChild(pin);
    });
    // 저장된 북마크 상태 복원
    restoreBookmarkStates();
  }

  function toggleBookmark(blockEl, pinBtn) {
    const key = getBlockKey(blockEl);
    if (!key) return;
    const bm = loadBookmarks();
    if (bm[key]) {
      delete bm[key];
      blockEl.classList.remove('bookmarked');
      if (pinBtn) pinBtn.classList.remove('active');
    } else {
      const sec = blockEl.closest('.section');
      const secs = Array.from(document.querySelectorAll('.section'));
      const si = secs.indexOf(sec);
      bm[key] = { title: getBlockTitle(blockEl), si, tabName: getTabName(si) };
      blockEl.classList.add('bookmarked');
      if (pinBtn) pinBtn.classList.add('active');
    }
    saveBookmarks(bm);
    updateBadge();
  }

  function restoreBookmarkStates() {
    const bm = loadBookmarks();
    document.querySelectorAll('.section').forEach((sec, si) => {
      const blocks = Array.from(sec.querySelectorAll('.block, .intro-block, .mistake-block'));
      blocks.forEach((blockEl, bi) => {
        const key = `${si}_${bi}`;
        const pin = blockEl.querySelector('.bookmark-pin-btn');
        if (bm[key]) {
          blockEl.classList.add('bookmarked');
          if (pin) pin.classList.add('active');
        } else {
          blockEl.classList.remove('bookmarked');
          if (pin) pin.classList.remove('active');
        }
      });
    });
  }

  // ── 모달 열기/닫기 ────────────────────────────────────────────
  window.openBookmarkModal = function() {
    const modal = document.getElementById('bookmark-modal');
    if (!modal) return;
    renderBookmarkList();
    modal.classList.add('open');
  };
  window.closeBookmarkModal = function() {
    document.getElementById('bookmark-modal').classList.remove('open');
  };

  function renderBookmarkList() {
    const list = document.getElementById('bookmark-list');
    if (!list) return;
    const bm = loadBookmarks();
    const keys = Object.keys(bm);
    if (!keys.length) {
      list.innerHTML = '<div class="bookmark-empty">📌 북마크가 없습니다.<br>각 항목 제목 우측의 📌 버튼을 눌러 북마크를 추가하세요.</div>';
      return;
    }
    // 탭 순서대로 정렬
    keys.sort((a, b) => {
      const [as, ab] = a.split('_').map(Number);
      const [bs, bb] = b.split('_').map(Number);
      return as !== bs ? as - bs : ab - bb;
    });
    list.innerHTML = keys.map(key => {
      const item = bm[key];
      return `<div class="bookmark-item" role="listitem">
        <button class="bookmark-item" style="flex:1;padding:0;background:none;border:none;" onclick="jumpToBookmark('${key}')">
          <span class="bookmark-item-tab">${escHtml(item.tabName)}</span>
          <span class="bookmark-item-body"><span class="bookmark-item-title">${escHtml(item.title)}</span></span>
        </button>
        <button class="bookmark-item-remove" onclick="removeBookmark('${key}')" title="북마크 제거" aria-label="북마크 제거">✕</button>
      </div>`;
    }).join('');
  }

  function escHtml(s) {
    const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
  }

  window.jumpToBookmark = function(key) {
    const bm = loadBookmarks();
    const item = bm[key];
    if (!item) return;
    closeBookmarkModal();
    // 탭 이동 후 스크롤
    if (typeof go === 'function') go(item.si);
    setTimeout(() => {
      const sec = document.querySelectorAll('.section')[item.si];
      if (!sec) return;
      const [, bi] = key.split('_').map(Number);
      const blocks = sec.querySelectorAll('.block, .intro-block, .mistake-block');
      const blockEl = blocks[bi];
      if (!blockEl) return;
      // 접혀있으면 펼치기
      const body = blockEl.querySelector('.block-body');
      if (body && body.classList.contains('collapsed')) {
        body.classList.remove('collapsed');
        const toggle = blockEl.querySelector('.block-toggle');
        if (toggle) toggle.classList.remove('is-collapsed');
      }
      blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      blockEl.classList.add('search-highlight');
      setTimeout(() => blockEl.classList.remove('search-highlight'), 1800);
    }, 80);
  };

  window.removeBookmark = function(key) {
    const bm = loadBookmarks();
    delete bm[key];
    saveBookmarks(bm);
    // UI 상태 동기화
    const [si, bi] = key.split('_').map(Number);
    const sec = document.querySelectorAll('.section')[si];
    if (sec) {
      const blockEl = sec.querySelectorAll('.block, .intro-block, .mistake-block')[bi];
      if (blockEl) {
        blockEl.classList.remove('bookmarked');
        const pin = blockEl.querySelector('.bookmark-pin-btn');
        if (pin) pin.classList.remove('active');
      }
    }
    updateBadge();
    renderBookmarkList();
  };

  // Escape 닫기
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const m = document.getElementById('bookmark-modal');
      if (m && m.classList.contains('open')) closeBookmarkModal();
    }
  });

  // 초기화
  addPinButtons();
  updateBadge();
})();

// ══════════════════════════════════════════════════════════════════
// ⑦ 목차 사이드바
// ══════════════════════════════════════════════════════════════════
(function initToc() {
  const KEY = 'pyguide_toc';
  let tocOpen = localStorage.getItem(KEY) === '1';
  let scrollObserver = null;

  const sidebar = document.getElementById('toc-sidebar');
  const toggleBtn = document.getElementById('toc-toggle-btn');

  function applyTocState() {
    if (!sidebar || !toggleBtn) return;
    sidebar.classList.toggle('open', tocOpen);
    toggleBtn.classList.toggle('open', tocOpen);
    if (tocOpen) buildToc();
  }

  // ── sticky-header 높이를 읽어서 top 값 동적 조정 ─────────────
  function adjustSidebarTop() {
    const header = document.querySelector('.sticky-header');
    if (!header || !sidebar) return;
    const h = header.getBoundingClientRect().height;
    sidebar.style.top = (h + 12) + 'px';
    sidebar.style.maxHeight = `calc(100vh - ${h + 28}px)`;
  }

  // ── 현재 활성 탭 블록 목록으로 목차 빌드 ─────────────────────
  function buildToc() {
    const tocList = document.getElementById('toc-list');
    if (!tocList) return;
    const activeSec = document.querySelector('.section.on');
    if (!activeSec) { tocList.innerHTML = ''; return; }

    const blocks = activeSec.querySelectorAll('.block, .intro-block, .mistake-block');
    if (!blocks.length) {
      tocList.innerHTML = '<li style="padding:6px 12px;font-size:12px;color:var(--color-text-tertiary);font-family:var(--font-sans);">항목 없음</li>';
      return;
    }

    tocList.innerHTML = Array.from(blocks).map((b, i) => {
      // project-block은 .project-hd에서 제목 읽기, 나머지는 h3
      let rawTitle;
      if (b.classList.contains('project-block')) {
        const hd = b.querySelector('.project-hd');
        rawTitle = hd
          ? hd.childNodes[0] && hd.childNodes[0].nodeType === Node.TEXT_NODE
            ? hd.childNodes[0].textContent.trim()
            : hd.textContent.replace(/[▶▼▶📌]/g, '').replace(/\s+/g, ' ').trim()
          : `미니 프로젝트 ${i + 1}`;
      } else {
        const h3 = b.querySelector('h3');
        if (h3) {
          const clone = h3.cloneNode(true);
          // 목차에서는 intro-icon 이모지 제거 (작은 폰트에서 깨져 보임)
          clone.querySelectorAll('.intro-icon').forEach(el => el.remove());
          // ▶▼▶ 는 접기/펼치기 UI 기호, 📌 는 북마크 UI — 둘 다 제거
          rawTitle = clone.textContent.replace(/[▶▼📌]/g, '').replace(/\s+/g, ' ').trim();
        } else {
          rawTitle = `항목 ${i + 1}`;
        }
      }
      const title = rawTitle;
      // project-block은 별도 스타일 클래스 추가
      const cls = b.classList.contains('project-block') ? ' toc-project' : '';
      return `<li><button class="toc-item${cls}" data-idx="${i}" title="${escHtml(title)}">${escHtml(title || rawTitle)}</button></li>`;
    }).join('');

    // 클릭 이벤트
    tocList.querySelectorAll('.toc-item').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        const target = blocks[i];
        if (!target) return;
        // 접혀있으면 펼치기
        const body = target.querySelector('.block-body');
        if (body && body.classList.contains('collapsed')) {
          body.classList.remove('collapsed');
          const toggle = target.querySelector('.block-toggle');
          if (toggle) toggle.classList.remove('is-collapsed');
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveItem(i);
      });
    });

    // 스크롤 감지 → active 하이라이트
    setupScrollSpy(blocks);
    adjustSidebarTop();
  }

  function escHtml(s) {
    const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
  }

  function setActiveItem(idx) {
    const tocList = document.getElementById('toc-list');
    if (!tocList) return;
    tocList.querySelectorAll('.toc-item').forEach((btn, i) => {
      btn.classList.toggle('active', i === idx);
    });
    // 활성 항목이 보이도록 스크롤
    const activeBtn = tocList.querySelector('.toc-item.active');
    if (activeBtn) {
      activeBtn.scrollIntoView({ block: 'nearest' });
    }
  }

  function setupScrollSpy(blocks) {
    if (scrollObserver) scrollObserver.disconnect();
    const options = {
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    };
    let lastActive = -1;
    scrollObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = Array.from(blocks).indexOf(entry.target);
          if (idx >= 0 && idx !== lastActive) {
            lastActive = idx;
            setActiveItem(idx);
          }
        }
      });
    }, options);
    blocks.forEach(b => scrollObserver.observe(b));
  }

  // ── 탭 전환 시 목차 재빌드 ────────────────────────────────────
  window._onTabChange = function() {
    if (tocOpen) requestAnimationFrame(() => buildToc());
  };

  // ── 토글 ──────────────────────────────────────────────────────
  window.toggleToc = function() {
    tocOpen = !tocOpen;
    localStorage.setItem(KEY, tocOpen ? '1' : '0');
    applyTocState();
  };

  // 사이드바 sticky top 조정 (리사이즈 대응)
  window.addEventListener('resize', adjustSidebarTop);

  // 초기화
  applyTocState();
})();


// ══════════════════════════════════════════════════════════════════
// ⑧ 학습 시간 트래커
// ══════════════════════════════════════════════════════════════════
(function initStudyTimer() {
  const KEY = 'pyguide_studytime';
  const TAB_COUNT = 16;

  let isRunning = false;
  let currentTabIdx = 0;
  let intervalId = null;
  let tabTimes = Array(TAB_COUNT).fill(0);

  // ── 저장/로드 ─────────────────────────────────────────────────
  function load() {
    const saved = _loadRaw(KEY);
    if (saved && Array.isArray(saved.tabs)) {
      tabTimes = saved.tabs.length >= TAB_COUNT
        ? saved.tabs.slice(0, TAB_COUNT)
        : [...saved.tabs, ...Array(TAB_COUNT - saved.tabs.length).fill(0)];
    } else {
      tabTimes = Array(TAB_COUNT).fill(0);
    }
  }

  function save() {
    saveProgress(KEY, { tabs: tabTimes });
  }

  // ── 시간 포맷 헬퍼 ────────────────────────────────────────────
  function fmtTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}시간 ${m}분 ${s}초`;
    if (m > 0) return `${m}분 ${s}초`;
    return `${s}초`;
  }

  function fmtShort(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}분 ${s}초`;
    return `${s}초`;
  }

  function totalSec() {
    return tabTimes.reduce((a, b) => a + (b || 0), 0);
  }

  // ── 탭 이름 읽기 ──────────────────────────────────────────────
  function getTabNames() {
    return Array.from(document.querySelectorAll('.tab')).map(t => {
      const raw = t.childNodes[0] && t.childNodes[0].nodeType === 3
        ? t.childNodes[0].textContent.trim()
        : t.textContent.trim();
      return raw.replace(/완료\s*\d+\/\d+/, '').trim();
    });
  }

  // ── UI 업데이트 ───────────────────────────────────────────────
  function updateDisplay() {
    const ico  = document.getElementById('study-timer-ico');
    const txt  = document.getElementById('study-timer-txt');
    const totalLabel = document.getElementById('study-timer-total-label');
    const tabList    = document.getElementById('study-timer-tab-list');
    const playBtn  = document.getElementById('std-play-btn');
    const pauseBtn = document.getElementById('std-pause-btn');
    const widget   = document.getElementById('study-timer-widget');

    // 위젯 텍스트
    const total = totalSec();
    if (txt) {
      txt.textContent = total > 0 ? fmtShort(total) : '학습 시간';
    }
    if (ico) ico.textContent = isRunning ? '⏱' : '⏱';
    if (widget) widget.classList.toggle('running', isRunning);

    // 드롭다운 총합 라벨
    if (totalLabel) {
      totalLabel.textContent = `총 ${fmtTime(total)}`;
    }

    // 탭별 시간 목록
    if (tabList) {
      const names = getTabNames();
      const rows = tabTimes
        .map((sec, i) => ({ sec: sec || 0, name: names[i] || `탭 ${i+1}`, idx: i }))
        .filter(r => r.sec > 0 || r.idx === currentTabIdx);

      if (rows.length === 0) {
        tabList.innerHTML = '<div class="std-empty">▶ 시작을 눌러 학습 시간을 기록하세요.</div>';
      } else {
        tabList.innerHTML = rows.map(r => {
          const isActive = r.idx === currentTabIdx && isRunning;
          return `<div class="std-tab-row${isActive ? ' active' : ''}">
            <span class="std-tab-name">${r.name}</span>
            <span class="std-tab-time">${r.sec > 0 ? fmtTime(r.sec) : '—'}</span>
          </div>`;
        }).join('');
      }
    }

    // 재생/정지 버튼 전환
    if (playBtn)  playBtn.style.display  = isRunning ? 'none' : '';
    if (pauseBtn) pauseBtn.style.display = isRunning ? '' : 'none';
  }

  // ── 타이머 제어 ───────────────────────────────────────────────
  function startTimer() {
    if (isRunning) return;
    isRunning = true;
    intervalId = setInterval(() => {
      tabTimes[currentTabIdx] = (tabTimes[currentTabIdx] || 0) + 1;
      save();
      updateDisplay();
    }, 1000);
    updateDisplay();
  }

  function pauseTimer() {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(intervalId);
    intervalId = null;
    updateDisplay();
  }

  function resetTimer() {
    if (!confirm('학습 시간 기록을 모두 초기화하시겠습니까?')) return;
    pauseTimer();
    tabTimes = Array(TAB_COUNT).fill(0);
    save();
    updateDisplay();
  }

  // ── 드롭다운 열기/닫기 ────────────────────────────────────────
  function openDropdown() {
    const w = document.getElementById('study-timer-widget');
    if (w) { w.classList.add('open'); updateDisplay(); }
  }
  function closeDropdown() {
    const w = document.getElementById('study-timer-widget');
    if (w) w.classList.remove('open');
  }

  // ── 이벤트 바인딩 ─────────────────────────────────────────────
  const widget = document.getElementById('study-timer-widget');
  if (widget) {
    // 위젯 본체 클릭 → 드롭다운 토글
    widget.addEventListener('click', () => {
      widget.classList.contains('open') ? closeDropdown() : openDropdown();
    });

    // 외부 클릭 → 드롭다운 닫기
    document.addEventListener('click', e => {
      if (!widget.contains(e.target)) closeDropdown();
    }, true);
  }

  const playBtn  = document.getElementById('std-play-btn');
  const pauseBtn = document.getElementById('std-pause-btn');
  const resetBtn = document.getElementById('std-reset-btn');

  if (playBtn)  playBtn.addEventListener('click',  e => { e.stopPropagation(); startTimer(); });
  if (pauseBtn) pauseBtn.addEventListener('click', e => { e.stopPropagation(); pauseTimer(); });
  if (resetBtn) resetBtn.addEventListener('click', e => { e.stopPropagation(); resetTimer(); });

  // ── 탭 전환 훅 연결 ───────────────────────────────────────────
  // _onTabChange는 initToc()에서 설정되므로 순서 보장 위해 기존 것 보존
  const _prevOnTabChange = window._onTabChange;
  window._onTabChange = function(tabIdx) {
    currentTabIdx = tabIdx;
    updateDisplay();
    if (typeof _prevOnTabChange === 'function') _prevOnTabChange(tabIdx);
  };

  // ── 초기화 ────────────────────────────────────────────────────
  load();
  // 현재 탭 인덱스 감지 (저장된 탭 위치 기준)
  const savedTab = _loadRaw('pyguide_tab');
  if (savedTab !== null && savedTab >= 0 && savedTab < TAB_COUNT) {
    currentTabIdx = savedTab;
  }
  updateDisplay();
})();