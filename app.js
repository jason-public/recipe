/**
 * ============================================================================
 * 맛있는 요리 레시피 큐레이션 웹 애플리케이션 - 메인 자바스크립트 (app.js)
 * ----------------------------------------------------------------------------
 * 이 파일은 구글 문서에서 추출한 297개의 레시피 데이터를 화면에 렌더링하고,
 * 사용자의 커스텀 변경 사항(카테고리 수정, 카드 삭제 및 선택 복원, 찜하기,
 * 데스크탑 4~7열 그리드 선택, 요리분류/채널·셰프 탭 전환, 유튜브 비디오 재생 및 전체화면)을
 * 브라우저 로컬 저장소(LocalStorage)를 통해 온·오프라인에서 영구 보존합니다.
 *
 * [주요 기능 목차]
 * 1. 전역 상태 관리 및 영구 저장소 키 정의
 * 2. 로컬 스토리지 데이터 로드 및 저장 (온·오프라인 영구 보존)
 * 3. 찜(즐겨찾기) 토글 로직
 * 4. 레시피 데이터 유효 카테고리 추출 헬퍼
 * 5. 요리분류(카테고리) 실시간 수정 로직
 * 6. 레시피 카드 삭제 로직
 * 7. 삭제된 레시피 선택 복원 모달 시스템 (개별 영상 복원 & 전체 복원)
 * 8. 데스크탑 4열, 5열, 6열, 7열 그리드 전환 시스템
 * 9. [신규] M3 필터 탭(요리분류 / 채널·셰프) 전환 시스템
 * 10. M3 알약(Pill) 필터 칩 동적 렌더링 및 개수 집계
 * 11. 다차원 검색 및 교차 필터링 로직
 * 12. 레시피 카드 그리드 렌더링 (구글 킵 스타일)
 * 13. M3 유튜브 비디오 임베드 모달 팝업 제어 (유튜브 오류 153 방지 & 전체화면 지원)
 * 14. "오늘 뭐 먹지?" 랜덤 레시피 추천 FAB 로직
 * 15. Material Ripple (물결 클릭) 애니메이션 구현
 * 16. 이벤트 리스너 등록 및 앱 초기 구동
 * ============================================================================
 */

// 엄격 모드 활성화 (코드의 잠재적 오류를 방지하고 최적화 보장)
'use strict';

/* ==========================================================================
   1. 전역 상태 관리 및 로컬 저장소 키 정의
   ========================================================================== */
const STORAGE_KEYS = {
  FAVORITES: 'recipe_curation_favorites_v1',         // 찜(즐겨찾기)한 레시피 ID 목록
  CATEGORY_OVERRIDES: 'recipe_category_overrides_v1', // 사용자가 수정한 요리분류 맵핑
  DELETED_IDS: 'recipe_deleted_ids_v1',               // 사용자가 삭제한 레시피 ID 목록
  GRID_COLUMNS: 'recipe_grid_columns_v1'              // 데스크탑 그리드 열 수 (4, 5, 6, 7)
};

const AppState = {
  // 현재 선택된 카테고리 필터 ("전체" 또는 특정 카테고리명)
  selectedCategory: '전체',
  // 현재 선택된 채널/셰프 필터 ("전체" 또는 특정 셰프/채널명)
  selectedChannel: '전체',
  // 검색어 문자열
  searchKeyword: '',
  // 찜한 레시피만 보기 모드 활성화 여부
  showFavoritesOnly: false,
  // 모달 전체화면 모드 여부
  isFullscreenMode: false,
  // 현재 선택된 데스크탑 그리드 열 수 (기본 4열, 4~7 지원)
  gridColumns: 4,
  // [신규] 현재 활성화된 필터 탭 ('category' 또는 'channel')
  activeFilterTab: 'category',
  
  // 찜한 레시피 ID 집합 (빠른 조회를 위해 Set 사용)
  favoriteIds: new Set(),
  // 사용자가 수정한 카테고리 맵핑 { [recipeId]: '새로운 카테고리' }
  categoryOverrides: {},
  // 사용자가 삭제한 레시피 ID 집합 (Set)
  deletedIds: new Set(),

  // 현재 카테고리 수정 대상 레시피 객체
  targetEditRecipe: null,
  // 현재 삭제 대상 레시피 객체
  targetDeleteRecipe: null
};

// 주요 DOM 요소 캐싱 (페이지 내 HTML 태그들을 변수에 연결)
const DOM = {
  // 상단 앱바 요소
  totalCountBadge: document.getElementById('totalCountBadge'),
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  favoriteToggleBtn: document.getElementById('favoriteToggleBtn'),
  favCountBadge: document.getElementById('favCountBadge'),

  // [신규] M3 필터 탭 및 패널 요소
  tabCategoryBtn: document.getElementById('tabCategoryBtn'),
  tabChannelBtn: document.getElementById('tabChannelBtn'),
  tabPanelCategory: document.getElementById('tabPanelCategory'),
  tabPanelChannel: document.getElementById('tabPanelChannel'),

  // 필터 컨테이너 및 알약 칩 영역
  filterContainer: document.getElementById('filterContainer'),
  categoryChips: document.getElementById('categoryChips'),
  channelChips: document.getElementById('channelChips'),

  // 상태바 요소
  statusBar: document.getElementById('statusBar'),
  resultCount: document.getElementById('resultCount'),
  resetFilterBtn: document.getElementById('resetFilterBtn'),
  restoreDeletedBtn: document.getElementById('restoreDeletedBtn'),
  deletedCountText: document.getElementById('deletedCountText'),
  gridSegmentedGroup: document.getElementById('gridSegmentedGroup'),

  // 레시피 메인 컨테이너 및 그리드
  recipeContainer: document.getElementById('recipeContainer'),
  recipeGrid: document.getElementById('recipeGrid'),

  // 플로팅 및 상단 액션 버튼
  scrollTopBtn: document.getElementById('scrollTopBtn'),
  randomRecipeBtn: document.getElementById('randomRecipeBtn') || document.getElementById('randomRecipeFab'),
  randomRecipeFab: document.getElementById('randomRecipeFab'),
  
  // 비디오 재생 모달 요소
  videoModal: document.getElementById('videoModal'),
  videoDialogCard: document.getElementById('videoDialogCard'),
  modalFullscreenBtn: document.getElementById('modalFullscreenBtn'),
  fullscreenIcon: document.getElementById('fullscreenIcon'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
  videoFrameContainer: document.getElementById('videoFrameContainer'),
  videoIframe: document.getElementById('videoIframe'),
  modalRecipeTitle: document.getElementById('modalRecipeTitle'),
  modalChannelName: document.getElementById('modalChannelName'),
  modalCategoryBadge: document.getElementById('modalCategoryBadge'),
  modalExternalLink: document.getElementById('modalExternalLink'),

  // 랜덤 추천 모달 요소
  randomModal: document.getElementById('randomModal'),
  randomModalCloseBtn: document.getElementById('randomModalCloseBtn'),
  randomModalBody: document.getElementById('randomModalBody'),

  // 카테고리 수정 모달 요소
  categoryEditModal: document.getElementById('categoryEditModal'),
  categoryEditCloseBtn: document.getElementById('categoryEditCloseBtn'),
  editTargetRecipeTitle: document.getElementById('editTargetRecipeTitle'),
  categoryOptionList: document.getElementById('categoryOptionList'),

  // 삭제 확인 다이얼로그 요소
  deleteConfirmModal: document.getElementById('deleteConfirmModal'),
  deleteConfirmCloseBtn: document.getElementById('deleteConfirmCloseBtn'),
  deleteTargetRecipeTitle: document.getElementById('deleteTargetRecipeTitle'),
  cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),

  // 삭제된 레시피 선택 복원 모달 요소
  restoreSelectModal: document.getElementById('restoreSelectModal'),
  restoreSelectCloseBtn: document.getElementById('restoreSelectCloseBtn'),
  closeRestoreModalBtn: document.getElementById('closeRestoreModalBtn'),
  restoreAllItemsBtn: document.getElementById('restoreAllItemsBtn'),
  restoreSelectList: document.getElementById('restoreSelectList'),

  // 토스트 알림 요소
  toastMessage: document.getElementById('toastMessage'),
  toastIcon: document.getElementById('toastIcon'),
  toastText: document.getElementById('toastText')
};

/* ==========================================================================
   2. 로컬 스토리지 데이터 로드 및 저장 (온·오프라인 영구 보존)
   ========================================================================== */
/**
 * 브라우저 로컬 저장소(LocalStorage)에서 저장된 모든 사용자 데이터를 불러옵니다.
 */
function loadAllUserData() {
  try {
    // 1. 찜 목록 불러오기
    const savedFavs = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    if (savedFavs) {
      AppState.favoriteIds = new Set(JSON.parse(savedFavs));
    }

    // 2. 사용자가 수정한 카테고리 맵핑 불러오기
    const savedOverrides = localStorage.getItem(STORAGE_KEYS.CATEGORY_OVERRIDES);
    if (savedOverrides) {
      AppState.categoryOverrides = JSON.parse(savedOverrides);
    }

    // 3. 삭제 목록 불러오기
    const savedDeleted = localStorage.getItem(STORAGE_KEYS.DELETED_IDS);
    if (savedDeleted) {
      AppState.deletedIds = new Set(JSON.parse(savedDeleted));
    }

    // 4. 데스크탑 그리드 열 수 불러오기 (기본값 4)
    const savedCols = localStorage.getItem(STORAGE_KEYS.GRID_COLUMNS);
    if (savedCols && ['4', '5', '6', '7'].includes(savedCols)) {
      AppState.gridColumns = parseInt(savedCols, 10);
    }

    console.log(`[Storage] 온오프라인 데이터 로드 완료: 찜 ${AppState.favoriteIds.size}개, 수정 카테고리 ${Object.keys(AppState.categoryOverrides).length}개, 삭제 ${AppState.deletedIds.size}개, 그리드 ${AppState.gridColumns}열`);
  } catch (error) {
    console.error('로컬 데이터를 불러오는 중 오류가 발생했습니다:', error);
  }

  // 상단 배지 및 카운터 UI 갱신
  updateBadgesAndCounters();
}

/**
 * 찜한 목록을 로컬 스토리지에 저장합니다.
 */
function saveFavorites() {
  try {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(Array.from(AppState.favoriteIds)));
  } catch (error) {
    console.error('찜 목록 저장 실패:', error);
  }
  updateBadgesAndCounters();
}

/**
 * 수정된 카테고리 맵핑을 로컬 스토리지에 저장합니다.
 */
function saveCategoryOverrides() {
  try {
    localStorage.setItem(STORAGE_KEYS.CATEGORY_OVERRIDES, JSON.stringify(AppState.categoryOverrides));
  } catch (error) {
    console.error('카테고리 수정 내역 저장 실패:', error);
  }
}

/**
 * 삭제된 레시피 ID 목록을 로컬 스토리지에 저장합니다.
 */
function saveDeletedIds() {
  try {
    localStorage.setItem(STORAGE_KEYS.DELETED_IDS, JSON.stringify(Array.from(AppState.deletedIds)));
  } catch (error) {
    console.error('삭제 목록 저장 실패:', error);
  }
  updateBadgesAndCounters();
}

/**
 * 상단 찜 배지, 전체 레시피 수, 삭제 복원 버튼의 표시 상태와 숫자를 갱신합니다.
 */
function updateBadgesAndCounters() {
  if (DOM.favCountBadge) {
    DOM.favCountBadge.textContent = `(${AppState.favoriteIds.size})`;
  }

  const deletedCount = AppState.deletedIds.size;
  if (DOM.restoreDeletedBtn) {
    if (deletedCount > 0) {
      DOM.restoreDeletedBtn.style.display = 'inline-flex';
      DOM.deletedCountText.textContent = `삭제된 레시피 복원 (${deletedCount}개)`;
    } else {
      DOM.restoreDeletedBtn.style.display = 'none';
    }
  }

  const activeTotalCount = RECIPE_DATA.length - deletedCount;
  if (DOM.totalCountBadge) {
    DOM.totalCountBadge.textContent = `${activeTotalCount}개`;
  }
}

/* ==========================================================================
   3. 찜(즐겨찾기) 토글 로직
   ========================================================================== */
/**
 * 특정 레시피의 찜(즐겨찾기) 상태를 반전하고 저장합니다.
 * @param {string} recipeId 레시피 고유 ID
 */
function toggleFavorite(recipeId) {
  const isFav = AppState.favoriteIds.has(recipeId);
  if (isFav) {
    AppState.favoriteIds.delete(recipeId);
    showToast('찜 목록에서 제외되었습니다.', 'favorite_border');
  } else {
    AppState.favoriteIds.add(recipeId);
    showToast('레시피를 찜 목록에 담았습니다!', 'favorite');
  }
  saveFavorites();

  // 현재 찜 모아보기 모드 중이면 그리드를 다시 렌더링하고, 아니면 해당 카드의 하트 아이콘만 갱신
  if (AppState.showFavoritesOnly) {
    renderRecipeGrid();
  } else {
    const cardFavBtn = DOM.recipeGrid.querySelector(`.recipe-card[data-id="${recipeId}"] .card-favorite-btn`);
    if (cardFavBtn) {
      cardFavBtn.classList.toggle('favorited', !isFav);
      cardFavBtn.title = !isFav ? '찜 취소' : '찜하기';
    }
  }
}

/* ==========================================================================
   4. 레시피 카테고리 추출 및 유효성 헬퍼
   ========================================================================== */
/**
 * 삭제되지 않고 현재 활성화되어 있는 레시피 목록만 반환합니다.
 */
function getActiveRecipes() {
  return RECIPE_DATA.filter(recipe => !AppState.deletedIds.has(recipe.id));
}

/**
 * 사용자가 수정한 분류가 있으면 해당 분류를 우선 적용하고, 없으면 기본 분류를 반환합니다.
 */
function getEffectiveCategory(recipe) {
  if (AppState.categoryOverrides && AppState.categoryOverrides[recipe.id]) {
    return AppState.categoryOverrides[recipe.id];
  }
  return recipe.category;
}

/* ==========================================================================
   5. 요리분류(카테고리) 수정 모달 로직
   ========================================================================== */
/**
 * 카테고리 수정 모달을 열고 선택 가능한 카테고리 버튼들을 렌더링합니다.
 */
function openCategoryEditModal(recipe) {
  AppState.targetEditRecipe = recipe;
  const currentCat = getEffectiveCategory(recipe);

  DOM.editTargetRecipeTitle.textContent = `[#${String(recipe.indexNumber).padStart(3, '0')}] ${recipe.title}`;
  
  const selectableCategories = CATEGORIES.filter(c => c !== '전체');

  DOM.categoryOptionList.innerHTML = selectableCategories.map(cat => {
    const isSelected = (cat === currentCat);
    return `
      <button 
        type="button" 
        class="category-option-btn ripple-target ${isSelected ? 'selected' : ''}" 
        data-category="${cat}"
      >
        <span>${cat}</span>
        ${isSelected ? '<span class="material-symbols-outlined" style="font-size: 18px;">check</span>' : ''}
      </button>
    `;
  }).join('');

  const optionButtons = DOM.categoryOptionList.querySelectorAll('.category-option-btn');
  optionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedNewCat = btn.getAttribute('data-category');
      applyCategoryChange(recipe.id, selectedNewCat);
    });
  });

  DOM.categoryEditModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

/**
 * 카테고리 수정 모달을 닫습니다.
 */
function closeCategoryEditModal() {
  DOM.categoryEditModal.classList.remove('open');
  AppState.targetEditRecipe = null;
  document.body.style.overflow = '';
}

/**
 * 새로운 카테고리를 저장하고 화면을 갱신합니다.
 */
function applyCategoryChange(recipeId, newCategory) {
  AppState.categoryOverrides[recipeId] = newCategory;
  saveCategoryOverrides();

  closeCategoryEditModal();
  showToast(`요리 분류가 '${newCategory}'(으)로 변경되었습니다.`, 'check_circle');

  renderFilterChips();
  renderRecipeGrid();
}

/* ==========================================================================
   6. 레시피 카드 삭제 로직
   ========================================================================== */
/**
 * 레시피 삭제 확인 모달을 엽니다.
 */
function openDeleteConfirmModal(recipe) {
  AppState.targetDeleteRecipe = recipe;
  DOM.deleteTargetRecipeTitle.textContent = `[#${String(recipe.indexNumber).padStart(3, '0')}] ${recipe.title}`;
  DOM.deleteConfirmModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

/**
 * 레시피 삭제 확인 모달을 닫습니다.
 */
function closeDeleteConfirmModal() {
  DOM.deleteConfirmModal.classList.remove('open');
  AppState.targetDeleteRecipe = null;
  document.body.style.overflow = '';
}

/**
 * 사용자가 삭제 확인 버튼을 눌렀을 때 실행됩니다.
 */
function confirmDeleteRecipe() {
  if (!AppState.targetDeleteRecipe) return;

  const recipeId = AppState.targetDeleteRecipe.id;
  AppState.deletedIds.add(recipeId);
  saveDeletedIds();

  closeDeleteConfirmModal();
  showToast('레시피 카드가 삭제되었습니다. (상단에서 언제든 복원 가능)', 'delete');

  renderFilterChips();
  renderRecipeGrid();
}

/* ==========================================================================
   7. 삭제된 레시피 선택 복원 모달 시스템
   ========================================================================== */
/**
 * 삭제된 레시피 목록을 확인하고 원하는 영상을 선택하여 복원할 수 있는 모달을 엽니다.
 */
function openRestoreSelectModal() {
  const deletedCount = AppState.deletedIds.size;
  if (deletedCount === 0) {
    showToast('복원할 삭제된 레시피가 없습니다.', 'info');
    return;
  }

  // 삭제된 레시피 목록 렌더링
  renderRestoreSelectList();

  // 모달 표시
  DOM.restoreSelectModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

/**
 * 복원 모달을 닫습니다.
 */
function closeRestoreSelectModal() {
  DOM.restoreSelectModal.classList.remove('open');
  document.body.style.overflow = '';
}

/**
 * 삭제된 레시피들을 모달 내부에 카드 리스트 형태로 렌더링합니다.
 */
function renderRestoreSelectList() {
  // 삭제된 레시피 ID들에 해당하는 원본 레시피 객체 추출
  const deletedRecipes = RECIPE_DATA.filter(recipe => AppState.deletedIds.has(recipe.id));

  // 만약 삭제된 레시피가 더 이상 없으면 모달 닫기
  if (deletedRecipes.length === 0) {
    closeRestoreSelectModal();
    return;
  }

  DOM.restoreSelectList.innerHTML = deletedRecipes.map(recipe => {
    const effectiveCategory = getEffectiveCategory(recipe);
    const formattedNum = String(recipe.indexNumber).padStart(3, '0');

    return `
      <div class="restore-item-card" data-id="${recipe.id}">
        <div class="restore-item-left">
          <img 
            src="${recipe.thumbnail}" 
            alt="${recipe.title}" 
            class="restore-thumb-img" 
            onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&auto=format&fit=crop&q=80';"
          />
          <div class="restore-item-info">
            <div class="restore-item-title" title="${recipe.title}">
              [#${formattedNum}] ${recipe.title}
            </div>
            <div class="restore-item-meta">
              <span>${recipe.channel}</span>
              <span>·</span>
              <span>${effectiveCategory}</span>
            </div>
          </div>
        </div>
        <button 
          type="button" 
          class="single-restore-btn ripple-target" 
          data-id="${recipe.id}"
          title="이 영상 복원하기"
        >
          <span class="material-symbols-outlined" style="font-size: 16px;">restore</span>
          <span>복원</span>
        </button>
      </div>
    `;
  }).join('');

  // 각 개별 복원 버튼에 이벤트 리스너 바인딩
  const restoreButtons = DOM.restoreSelectList.querySelectorAll('.single-restore-btn');
  restoreButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const recipeId = btn.getAttribute('data-id');
      restoreSingleRecipe(recipeId);
    });
  });
}

/**
 * 사용자가 선택한 특정 레시피 1개만 복원합니다.
 * @param {string} recipeId 복원할 레시피 ID
 */
function restoreSingleRecipe(recipeId) {
  const recipe = RECIPE_DATA.find(r => r.id === recipeId);
  if (!recipe) return;

  // 1. 삭제 목록에서 해당 ID 제거
  AppState.deletedIds.delete(recipeId);

  // 2. 로컬 스토리지에 영구 저장 및 배지 업데이트
  saveDeletedIds();

  // 3. 필터 칩 개수 재집계 및 레시피 카드 그리드 재렌더링
  renderFilterChips();
  renderRecipeGrid();

  // 4. 완료 알림 토스트 표시
  showToast(`'${recipe.title}' 레시피가 복원되었습니다!`, 'restore');

  // 5. 모달 안의 목록 갱신 (남은 항목이 없으면 모달 자동 닫힘)
  renderRestoreSelectList();
}

/**
 * 삭제된 모든 레시피를 한꺼번에 일괄 복원합니다.
 */
function restoreAllDeletedRecipes() {
  const count = AppState.deletedIds.size;
  if (count === 0) {
    showToast('복원할 삭제된 레시피가 없습니다.', 'info');
    return;
  }

  // 1. 삭제 목록 전체 비우기
  AppState.deletedIds.clear();

  // 2. 로컬 스토리지 저장 및 배지 갱신
  saveDeletedIds();

  // 3. 모달 닫기
  closeRestoreSelectModal();

  // 4. 필터 칩 및 그리드 재렌더링
  renderFilterChips();
  renderRecipeGrid();

  // 5. 안내 토스트
  showToast(`삭제되었던 ${count}개의 레시피가 모두 성공적으로 복원되었습니다!`, 'restore_from_trash');
}

// 전역 window 객체에도 바인딩하여 안전성 보장
window.openRestoreSelectModal = openRestoreSelectModal;
window.restoreAllDeletedRecipes = restoreAllDeletedRecipes;

/* ==========================================================================
   8. 데스크탑 4열, 5열, 6열, 7열 그리드 전환 시스템
   ========================================================================== */
/**
 * 데스크탑 화면에서 레시피 카드의 열(Column) 개수를 4열, 5열, 6열, 7열로 설정합니다.
 * @param {number} cols 설정할 열 수 (4, 5, 6, 7)
 * @param {boolean} showToastMsg 토스트 알림 표시 여부
 */
function setGridColumns(cols, showToastMsg = true) {
  if (![4, 5, 6, 7].includes(cols)) return;

  AppState.gridColumns = cols;

  // 로컬 스토리지에 사용자의 선택 저장
  try {
    localStorage.setItem(STORAGE_KEYS.GRID_COLUMNS, cols.toString());
  } catch (e) {
    console.error('그리드 설정 저장 실패:', e);
  }

  // 1. 레시피 그리드 클래스 변경
  DOM.recipeGrid.className = `recipe-grid grid-cols-${cols}`;

  // 2. 메인 컨테이너 및 상태바, 필터바의 최대 너비 클래스 변경 (대화면 최적화)
  if (DOM.recipeContainer) {
    DOM.recipeContainer.className = `recipe-container cols-${cols}`;
  }
  if (DOM.statusBar) {
    DOM.statusBar.className = `status-bar cols-${cols}`;
  }
  if (DOM.filterContainer) {
    DOM.filterContainer.className = `filter-container cols-${cols}`;
  }

  // 3. 세그먼트 버튼 active 상태 갱신
  if (DOM.gridSegmentedGroup) {
    const buttons = DOM.gridSegmentedGroup.querySelectorAll('.segmented-btn');
    buttons.forEach(btn => {
      const btnCols = parseInt(btn.getAttribute('data-cols'), 10);
      if (btnCols === cols) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  if (showToastMsg) {
    showToast(`화면 그리드가 ${cols}열로 변경되었습니다.`, 'view_column');
  }
}

/* ==========================================================================
   9. [신규] M3 필터 탭(요리분류 / 채널·셰프) 전환 시스템
   ========================================================================== */
/**
 * 요리분류 탭과 채널·셰프 탭을 전환합니다.
 * @param {'category' | 'channel'} tabName 전환할 탭 이름
 */
function switchFilterTab(tabName) {
  AppState.activeFilterTab = tabName;

  if (tabName === 'category') {
    // 요리분류 탭 활성화
    DOM.tabCategoryBtn.classList.add('active');
    DOM.tabCategoryBtn.setAttribute('aria-selected', 'true');
    DOM.tabPanelCategory.classList.add('active');

    // 채널·셰프 탭 비활성화
    DOM.tabChannelBtn.classList.remove('active');
    DOM.tabChannelBtn.setAttribute('aria-selected', 'false');
    DOM.tabPanelChannel.classList.remove('active');
  } else {
    // 채널·셰프 탭 활성화
    DOM.tabChannelBtn.classList.add('active');
    DOM.tabChannelBtn.setAttribute('aria-selected', 'true');
    DOM.tabPanelChannel.classList.add('active');

    // 요리분류 탭 비활성화
    DOM.tabCategoryBtn.classList.remove('active');
    DOM.tabCategoryBtn.setAttribute('aria-selected', 'false');
    DOM.tabPanelCategory.classList.remove('active');
  }
}

/* ==========================================================================
   10. M3 알약(Pill) 필터 칩 렌더링 및 개수 집계
   ========================================================================== */
/**
 * 요리분류 및 채널/셰프 알약 칩을 동적으로 생성하고 각 항목별 레시피 개수를 표시합니다.
 */
function renderFilterChips() {
  const activeRecipes = getActiveRecipes();

  // 각 카테고리별 레시피 수 집계
  const categoryCounts = {};
  categoryCounts['전체'] = activeRecipes.length;
  
  // 각 채널별 레시피 수 집계
  const channelCounts = {};
  channelCounts['전체'] = activeRecipes.length;

  activeRecipes.forEach(recipe => {
    const effectiveCategory = getEffectiveCategory(recipe);
    categoryCounts[effectiveCategory] = (categoryCounts[effectiveCategory] || 0) + 1;
    channelCounts[recipe.channel] = (channelCounts[recipe.channel] || 0) + 1;
  });

  // 요리분류 칩 생성
  DOM.categoryChips.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const count = categoryCounts[cat] || 0;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `m3-chip ripple-target ${AppState.selectedCategory === cat ? 'active' : ''}`;
    chip.innerHTML = `
      <span>${cat}</span>
      <span class="chip-count">${count}</span>
    `;
    chip.addEventListener('click', () => {
      AppState.selectedCategory = cat;
      updateActiveChips();
      renderRecipeGrid();
    });
    DOM.categoryChips.appendChild(chip);
  });

  // 채널·셰프 칩 생성
  DOM.channelChips.innerHTML = '';
  CHANNELS.forEach(ch => {
    const count = channelCounts[ch] || 0;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `m3-chip ripple-target ${AppState.selectedChannel === ch ? 'active' : ''}`;
    chip.innerHTML = `
      <span>${ch}</span>
      <span class="chip-count">${count}</span>
    `;
    chip.addEventListener('click', () => {
      AppState.selectedChannel = ch;
      updateActiveChips();
      renderRecipeGrid();
    });
    DOM.channelChips.appendChild(chip);
  });
}

/**
 * 현재 활성화된 칩의 스타일을 업데이트하고 필터 초기화 버튼의 노출 여부를 결정합니다.
 */
function updateActiveChips() {
  Array.from(DOM.categoryChips.children).forEach((chip, idx) => {
    const catName = CATEGORIES[idx];
    if (catName === AppState.selectedCategory) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });

  Array.from(DOM.channelChips.children).forEach((chip, idx) => {
    const chName = CHANNELS[idx];
    if (chName === AppState.selectedChannel) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });

  // 탭 텍스트에 현재 필터 적용 여부 표시 (사용자 편의 힌트)
  if (DOM.tabCategoryBtn) {
    const tabText = DOM.tabCategoryBtn.querySelector('.tab-text');
    if (tabText) {
      tabText.textContent = AppState.selectedCategory !== '전체' 
        ? `요리분류 (${AppState.selectedCategory})` 
        : '요리분류';
    }
  }

  if (DOM.tabChannelBtn) {
    const tabText = DOM.tabChannelBtn.querySelector('.tab-text');
    if (tabText) {
      tabText.textContent = AppState.selectedChannel !== '전체' 
        ? `채널·셰프 (${AppState.selectedChannel.split(' ')[0]})` 
        : '채널·셰프';
    }
  }

  // 조건이 하나라도 적용되어 있는지 확인
  const hasFilter = AppState.selectedCategory !== '전체' || 
                    AppState.selectedChannel !== '전체' || 
                    AppState.searchKeyword !== '' || 
                    AppState.showFavoritesOnly;

  DOM.resetFilterBtn.style.display = hasFilter ? 'inline-block' : 'none';
}

/* ==========================================================================
   11. 다차원 검색 및 필터링 로직
   ========================================================================== */
/**
 * 선택된 카테고리, 채널, 검색어, 찜 상태에 따라 필터링된 레시피 목록을 반환합니다.
 */
function getFilteredRecipes() {
  const query = AppState.searchKeyword.trim().toLowerCase();
  const activeRecipes = getActiveRecipes();

  return activeRecipes.filter(recipe => {
    const effectiveCategory = getEffectiveCategory(recipe);

    // 1. 카테고리 필터 검사
    if (AppState.selectedCategory !== '전체' && effectiveCategory !== AppState.selectedCategory) {
      return false;
    }

    // 2. 채널/셰프 필터 검사
    if (AppState.selectedChannel !== '전체' && recipe.channel !== AppState.selectedChannel) {
      return false;
    }

    // 3. 찜한 레시피 모아보기 모드 검사
    if (AppState.showFavoritesOnly && !AppState.favoriteIds.has(recipe.id)) {
      return false;
    }

    // 4. 검색어 일치 검사 (요리명, 셰프명, 분류명, 해시태그)
    if (query) {
      const matchTitle = recipe.title.toLowerCase().includes(query);
      const matchOrig = recipe.originalTitle.toLowerCase().includes(query);
      const matchChannel = recipe.channel.toLowerCase().includes(query);
      const matchCategory = effectiveCategory.toLowerCase().includes(query);
      const matchTags = recipe.tags.some(tag => tag.toLowerCase().includes(query));
      if (!matchTitle && !matchOrig && !matchChannel && !matchCategory && !matchTags) {
        return false;
      }
    }

    return true;
  });
}

/* ==========================================================================
   12. 레시피 카드 그리드 렌더링 (Google Keep Style)
   ========================================================================== */
/**
 * 검색/필터 조건에 부합하는 레시피들을 구글 킵(Keep) 스타일 카드로 렌더링합니다.
 */
function renderRecipeGrid() {
  const filteredList = getFilteredRecipes();

  // 검색된 결과 개수 갱신
  DOM.resultCount.textContent = filteredList.length;

  // 검색 결과가 없는 경우 친절한 빈 상태 화면 출력
  if (filteredList.length === 0) {
    DOM.recipeGrid.innerHTML = `
      <div class="no-results-box">
        <span class="material-symbols-outlined no-results-icon">soup_kitchen</span>
        <h3 class="no-results-title">조건에 맞는 레시피를 찾지 못했습니다</h3>
        <p class="no-results-desc">다른 검색어를 입력하시거나 상단의 카테고리/셰프 필터를 변경해 보세요.</p>
        <button type="button" class="m3-chip active ripple-target" onclick="resetAllFilters()">
          전체 레시피 다시 보기
        </button>
      </div>
    `;
    return;
  }

  // 카드 HTML 생성
  const cardsHtml = filteredList.map(recipe => {
    const isFavorited = AppState.favoriteIds.has(recipe.id);
    const effectiveCategory = getEffectiveCategory(recipe);

    let badgeText = '유튜브 영상';
    let badgeClass = '';
    let badgeIcon = 'play_arrow';

    if (recipe.mediaType === 'youtube_shorts') {
      badgeText = 'Shorts';
      badgeClass = 'shorts';
      badgeIcon = 'bolt';
    } else if (recipe.mediaType === 'youtube_playlist') {
      badgeText = '재생목록';
      badgeClass = 'playlist';
      badgeIcon = 'playlist_play';
    } else if (recipe.mediaType === 'article') {
      badgeText = '매거진/기사';
      badgeClass = '';
      badgeIcon = 'article';
    }

    const formattedNum = String(recipe.indexNumber).padStart(3, '0');
    const tagsHtml = recipe.tags.slice(0, 3).map(t => `<span class="card-small-tag">#${t}</span>`).join(' ');

    return `
      <article class="recipe-card ripple-target" data-id="${recipe.id}">
        <!-- 썸네일 이미지 박스 -->
        <div class="card-thumbnail-box">
          <img 
            src="${recipe.thumbnail}" 
            alt="${recipe.title}" 
            class="card-thumbnail-img" 
            loading="lazy" 
            onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&auto=format&fit=crop&q=80';"
          />
          <!-- 미디어 타입 배지 -->
          <div class="card-media-badge ${badgeClass}">
            <span class="material-symbols-outlined" style="font-size: 14px;">${badgeIcon}</span>
            <span>${badgeText}</span>
          </div>

          <!-- 카드 상단 우측 버튼 그룹: 삭제 + 찜하기 -->
          <div class="card-actions-top">
            <button 
              type="button" 
              class="card-delete-btn" 
              data-id="${recipe.id}"
              title="이 레시피 카드 삭제"
            >
              <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
            </button>
            <button 
              type="button" 
              class="card-favorite-btn ${isFavorited ? 'favorited' : ''}" 
              data-id="${recipe.id}"
              title="${isFavorited ? '찜 취소' : '찜하기'}"
            >
              <span class="material-symbols-outlined heart-icon" style="font-size: 20px;">favorite</span>
            </button>
          </div>
        </div>

        <!-- 카드 본문 정보 -->
        <div class="card-content">
          <div class="card-header-tags">
            <span class="card-index-tag">#${formattedNum}</span>
            <!-- 수정 가능한 요리분류 버튼 -->
            <button 
              type="button" 
              class="card-category-btn" 
              data-id="${recipe.id}"
              title="클릭하여 요리 분류 수정"
            >
              <span>${effectiveCategory}</span>
              <span class="material-symbols-outlined edit-icon">edit</span>
            </button>
          </div>

          <!-- 레시피 제목 -->
          <h2 class="card-title" title="${recipe.originalTitle}">
            ${recipe.title}
          </h2>

          <!-- 셰프/채널 캡슐 알약 태그 -->
          <div class="card-channel-pill">
            <span class="material-symbols-outlined channel-icon">chef_hat</span>
            <span>${recipe.channel}</span>
          </div>

          <!-- 하단 푸터 (태그 및 재생 버튼) -->
          <div class="card-footer">
            <div class="card-tags-list">
              ${tagsHtml}
            </div>
            <button type="button" class="card-play-btn ripple-target">
              <span class="material-symbols-outlined" style="font-size: 16px;">play_arrow</span>
              <span>보기</span>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  DOM.recipeGrid.innerHTML = cardsHtml;
  attachCardEventListeners();
}

/**
 * 렌더링된 각 카드들의 인터랙션(클릭, 찜, 삭제, 카테고리 수정) 이벤트 리스너를 등록합니다.
 */
function attachCardEventListeners() {
  const cards = DOM.recipeGrid.querySelectorAll('.recipe-card');

  cards.forEach(card => {
    const recipeId = card.getAttribute('data-id');
    const recipe = RECIPE_DATA.find(r => r.id === recipeId);
    if (!recipe) return;

    // 카드 본체 클릭 시 비디오 모달 열기 (내부 버튼 클릭 시에는 상위 전파 차단)
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-favorite-btn') || 
          e.target.closest('.card-delete-btn') || 
          e.target.closest('.card-category-btn')) {
        return;
      }
      openVideoModal(recipe);
    });

    // 찜 버튼 클릭
    const favBtn = card.querySelector('.card-favorite-btn');
    if (favBtn) {
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(recipeId);
      });
    }

    // 카드 삭제 버튼 클릭
    const deleteBtn = card.querySelector('.card-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteConfirmModal(recipe);
      });
    }

    // 요리분류 수정 버튼 클릭
    const catBtn = card.querySelector('.card-category-btn');
    if (catBtn) {
      catBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCategoryEditModal(recipe);
      });
    }
  });
}

/* ==========================================================================
   13. M3 유튜브 비디오 임베드 모달 팝업 제어 (유튜브 오류 153 방지 & 전체화면 지원)
   ========================================================================== */
/**
 * 레시피 영상을 인앱 모달 팝업에서 재생합니다.
 * - YouTube Error 153 방지: youtube-nocookie.com 도메인 및 origin 파라미터 적용
 */
function openVideoModal(recipe) {
  const effectiveCategory = getEffectiveCategory(recipe);

  DOM.modalRecipeTitle.textContent = recipe.title;
  DOM.modalChannelName.textContent = recipe.channel;
  DOM.modalCategoryBadge.textContent = `[${effectiveCategory}] #${String(recipe.indexNumber).padStart(3, '0')}`;
  DOM.modalExternalLink.href = recipe.url;

  // 유튜브 쇼츠인 경우 세로비율(9:16) 클래스 부여
  if (recipe.mediaType === 'youtube_shorts') {
    DOM.videoFrameContainer.classList.add('shorts-ratio');
  } else {
    DOM.videoFrameContainer.classList.remove('shorts-ratio');
  }

  // 유튜브 영상 재생 (YouTube 오류 153 완벽 방지)
  // 1) origin 매개변수 및 enablejsapi를 제거하여 localhost/도메인 불일치 에러 153 원천 차단
  // 2) 유튜브 공식 oEmbed 표준 규격(www.youtube.com/embed/ID) 적용
  if (recipe.youtubeId) {
    const embedSrc = `https://www.youtube.com/embed/${recipe.youtubeId}?autoplay=1&rel=0`;
    DOM.videoIframe.src = embedSrc;
  } else if (recipe.embedUrl && recipe.embedUrl.includes('embed/')) {
    DOM.videoIframe.src = recipe.embedUrl;
  } else {
    // 외부 기사 또는 유튜브가 아닌 링크
    window.open(recipe.url, '_blank', 'noopener,noreferrer');
    showToast('외부 기사 원본 링크로 이동합니다.', 'open_in_new');
    return;
  }

  // 모달 열릴 때는 일반 모드로 시작
  setModalFullscreen(false);

  DOM.videoModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

/**
 * 비디오 모달을 닫고 재생을 중지합니다.
 */
function closeVideoModal() {
  if (AppState.isFullscreenMode) {
    setModalFullscreen(false);
  }

  DOM.videoModal.classList.remove('open');
  DOM.videoIframe.src = '';
  document.body.style.overflow = '';
}

/**
 * 모달 전체화면 상태를 토글합니다.
 */
function toggleModalFullscreen() {
  setModalFullscreen(!AppState.isFullscreenMode);
}

/**
 * 모달의 전체화면 모드를 적용하거나 해제합니다.
 */
function setModalFullscreen(enable) {
  AppState.isFullscreenMode = enable;

  if (enable) {
    DOM.videoDialogCard.classList.add('fullscreen-mode');
    DOM.fullscreenIcon.textContent = 'fullscreen_exit';
    DOM.modalFullscreenBtn.title = '원래 크기로 축소';
    showToast('전체화면 모드로 전환되었습니다.', 'fullscreen');

    if (DOM.videoModal.requestFullscreen && !document.fullscreenElement) {
      DOM.videoModal.requestFullscreen().catch(() => {});
    }
  } else {
    DOM.videoDialogCard.classList.remove('fullscreen-mode');
    DOM.fullscreenIcon.textContent = 'fullscreen';
    DOM.modalFullscreenBtn.title = '전체화면으로 크게 보기';

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

/* ==========================================================================
   14. "오늘 뭐 먹지?" 랜덤 레시피 추천 FAB 로직
   ========================================================================== */
/**
 * 활성 레시피 중에서 무작위로 1개를 뽑아 추천 모달에 표시합니다.
 */
function pickRandomRecipe() {
  const targetList = getActiveRecipes();
  if (!targetList || targetList.length === 0) return;

  const randomIndex = Math.floor(Math.random() * targetList.length);
  const pickedRecipe = targetList[randomIndex];
  const effectiveCategory = getEffectiveCategory(pickedRecipe);

  DOM.randomModalBody.innerHTML = `
    <div style="margin-bottom: 16px; border-radius: 16px; overflow: hidden; aspect-ratio: 16/9; max-width: 400px; margin: 0 auto 16px;">
      <img src="${pickedRecipe.thumbnail}" alt="${pickedRecipe.title}" style="width: 100%; height: 100%; object-fit: cover;">
    </div>
    <div style="font-size: 0.82rem; color: var(--md-sys-color-primary); font-weight: 700; margin-bottom: 6px;">
      [${effectiveCategory}] ${pickedRecipe.channel}
    </div>
    <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--md-sys-color-on-surface); margin-bottom: 20px; line-height: 1.4;">
      "${pickedRecipe.title}"
    </h3>
    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
      <button type="button" class="m3-chip active ripple-target" id="openRandomRecipeVideoBtn">
        <span class="material-symbols-outlined" style="font-size: 18px;">play_arrow</span>
        <span>레시피 영상 바로보기</span>
      </button>
      <button type="button" class="m3-chip ripple-target" id="rerollRandomRecipeBtn">
        <span class="material-symbols-outlined" style="font-size: 18px;">refresh</span>
        <span>다시 뽑기</span>
      </button>
    </div>
  `;

  DOM.randomModal.classList.add('open');
  document.body.style.overflow = 'hidden';

  document.getElementById('openRandomRecipeVideoBtn').addEventListener('click', () => {
    DOM.randomModal.classList.remove('open');
    openVideoModal(pickedRecipe);
  });

  document.getElementById('rerollRandomRecipeBtn').addEventListener('click', () => {
    pickRandomRecipe();
  });
}

function closeRandomModal() {
  DOM.randomModal.classList.remove('open');
  document.body.style.overflow = '';
}

/* ==========================================================================
   15. Material Ripple (물결 클릭 터치 인터랙션)
   ========================================================================== */
function initRippleEffect() {
  document.addEventListener('click', function(e) {
    const target = e.target.closest('.ripple-target');
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const wave = document.createElement('span');
    wave.className = 'ripple-wave';

    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    wave.style.width = wave.style.height = `${size}px`;
    wave.style.left = `${x}px`;
    wave.style.top = `${y}px`;

    target.appendChild(wave);

    wave.addEventListener('animationend', () => {
      wave.remove();
    });
  });
}

/* ==========================================================================
   16. M3 토스트 메시지 함수
   ========================================================================== */
let toastTimeoutId = null;

function showToast(message, iconName = 'info') {
  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
  }

  DOM.toastText.textContent = message;
  DOM.toastIcon.textContent = iconName;
  DOM.toastMessage.classList.add('show');

  toastTimeoutId = setTimeout(() => {
    DOM.toastMessage.classList.remove('show');
  }, 2400);
}

/* ==========================================================================
   17. 전체 필터 초기화 함수
   ========================================================================== */
window.resetAllFilters = function() {
  AppState.selectedCategory = '전체';
  AppState.selectedChannel = '전체';
  AppState.searchKeyword = '';
  AppState.showFavoritesOnly = false;

  DOM.searchInput.value = '';
  DOM.clearSearchBtn.classList.remove('active');
  DOM.favoriteToggleBtn.classList.remove('active');

  updateActiveChips();
  renderRecipeGrid();
  showToast('모든 필터가 초기화되었습니다.', 'restart_alt');
};

/* ==========================================================================
   18. 이벤트 리스너 등록 및 앱 초기 구동
   ========================================================================== */
function setupEventListeners() {
  // 실시간 검색창 입력
  DOM.searchInput.addEventListener('input', (e) => {
    AppState.searchKeyword = e.target.value;
    if (AppState.searchKeyword.length > 0) {
      DOM.clearSearchBtn.classList.add('active');
    } else {
      DOM.clearSearchBtn.classList.remove('active');
    }
    updateActiveChips();
    renderRecipeGrid();
  });

  // 검색어 초기화(X) 버튼
  DOM.clearSearchBtn.addEventListener('click', () => {
    DOM.searchInput.value = '';
    AppState.searchKeyword = '';
    DOM.clearSearchBtn.classList.remove('active');
    updateActiveChips();
    renderRecipeGrid();
    DOM.searchInput.focus();
  });

  // 찜 모아보기 토글 버튼
  DOM.favoriteToggleBtn.addEventListener('click', () => {
    AppState.showFavoritesOnly = !AppState.showFavoritesOnly;
    if (AppState.showFavoritesOnly) {
      DOM.favoriteToggleBtn.classList.add('active');
      showToast('찜한 레시피만 모아봅니다.', 'favorite');
    } else {
      DOM.favoriteToggleBtn.classList.remove('active');
      showToast('전체 레시피 보기로 전환되었습니다.', 'list');
    }
    updateActiveChips();
    renderRecipeGrid();
  });

  // [신규] M3 필터 탭 클릭 이벤트 (요리분류 vs 채널·셰프)
  if (DOM.tabCategoryBtn) {
    DOM.tabCategoryBtn.addEventListener('click', () => switchFilterTab('category'));
  }
  if (DOM.tabChannelBtn) {
    DOM.tabChannelBtn.addEventListener('click', () => switchFilterTab('channel'));
  }

  // 필터 초기화 버튼
  DOM.resetFilterBtn.addEventListener('click', resetAllFilters);

  // 삭제된 레시피 복원 버튼 클릭 시 '복원 선택 모달' 열기
  if (DOM.restoreDeletedBtn) {
    DOM.restoreDeletedBtn.addEventListener('click', openRestoreSelectModal);
  }

  // 복원 선택 모달 닫기 및 전체 복원 버튼
  if (DOM.restoreSelectCloseBtn) {
    DOM.restoreSelectCloseBtn.addEventListener('click', closeRestoreSelectModal);
  }
  if (DOM.closeRestoreModalBtn) {
    DOM.closeRestoreModalBtn.addEventListener('click', closeRestoreSelectModal);
  }
  if (DOM.restoreAllItemsBtn) {
    DOM.restoreAllItemsBtn.addEventListener('click', restoreAllDeletedRecipes);
  }
  if (DOM.restoreSelectModal) {
    DOM.restoreSelectModal.addEventListener('click', (e) => {
      if (e.target === DOM.restoreSelectModal) closeRestoreSelectModal();
    });
  }

  // 데스크탑 4열, 5열, 6열, 7열 세그먼트 버튼 이벤트
  if (DOM.gridSegmentedGroup) {
    const buttons = DOM.gridSegmentedGroup.querySelectorAll('.segmented-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const cols = parseInt(btn.getAttribute('data-cols'), 10);
        setGridColumns(cols, true);
      });
    });
  }

  // 비디오 모달 전체화면 버튼 클릭
  DOM.modalFullscreenBtn.addEventListener('click', toggleModalFullscreen);

  // 비디오 모달 닫기
  DOM.modalCloseBtn.addEventListener('click', closeVideoModal);
  DOM.videoModal.addEventListener('click', (e) => {
    if (e.target === DOM.videoModal) closeVideoModal();
  });

  // 브라우저 풀스크린 상태 변경 감지
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && AppState.isFullscreenMode) {
      setModalFullscreen(false);
    }
  });

  // 랜덤 모달 닫기
  DOM.randomModalCloseBtn.addEventListener('click', closeRandomModal);
  DOM.randomModal.addEventListener('click', (e) => {
    if (e.target === DOM.randomModal) closeRandomModal();
  });

  // 카테고리 수정 모달 닫기
  DOM.categoryEditCloseBtn.addEventListener('click', closeCategoryEditModal);
  DOM.categoryEditModal.addEventListener('click', (e) => {
    if (e.target === DOM.categoryEditModal) closeCategoryEditModal();
  });

  // 삭제 확인 모달 닫기 및 삭제 수행
  DOM.deleteConfirmCloseBtn.addEventListener('click', closeDeleteConfirmModal);
  DOM.cancelDeleteBtn.addEventListener('click', closeDeleteConfirmModal);
  DOM.confirmDeleteBtn.addEventListener('click', confirmDeleteRecipe);
  DOM.deleteConfirmModal.addEventListener('click', (e) => {
    if (e.target === DOM.deleteConfirmModal) closeDeleteConfirmModal();
  });

  // 키보드 ESC 키로 열려있는 모든 모달 닫기
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (DOM.videoModal.classList.contains('open')) closeVideoModal();
      if (DOM.randomModal.classList.contains('open')) closeRandomModal();
      if (DOM.categoryEditModal.classList.contains('open')) closeCategoryEditModal();
      if (DOM.deleteConfirmModal.classList.contains('open')) closeDeleteConfirmModal();
      if (DOM.restoreSelectModal && DOM.restoreSelectModal.classList.contains('open')) closeRestoreSelectModal();
    }
  });

  // "오늘 뭐 먹지?" 추천 버튼 클릭 (상단 헤더 버튼 및 이전 FAB 호환 지원)
  if (DOM.randomRecipeBtn) {
    DOM.randomRecipeBtn.addEventListener('click', pickRandomRecipe);
  } else if (DOM.randomRecipeFab) {
    DOM.randomRecipeFab.addEventListener('click', pickRandomRecipe);
  }

  // 맨 위로 스크롤 버튼 표시 및 클릭
  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      DOM.scrollTopBtn.classList.add('visible');
    } else {
      DOM.scrollTopBtn.classList.remove('visible');
    }
  });

  DOM.scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

/**
 * 애플리케이션 진입점 (DOM 준비 완료 시 실행)
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('레시피 큐레이션 웹 애플리케이션 초기화 시작. 전체 레시피 데이터:', RECIPE_DATA.length);
  
  // 1. 로컬 저장소에서 찜, 카테고리 수정, 삭제 내역, 그리드 열 수 불러오기
  loadAllUserData();

  // 2. 저장된 그리드 열 수(4, 5, 6, 7열) 화면에 초기 적용
  setGridColumns(AppState.gridColumns, false);

  // 3. 알약 필터 칩 렌더링
  renderFilterChips();

  // 4. 레시피 그리드 초기 렌더링
  renderRecipeGrid();

  // 5. 기본 탭('category') 초기화
  switchFilterTab('category');

  // 6. 이벤트 리스너 등록
  setupEventListeners();

  // 7. 물결 터치(Ripple) 효과 초기화
  initRippleEffect();
});
