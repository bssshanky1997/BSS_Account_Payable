(function initializeEnterpriseReporter() {
  const cardsContainer = document.getElementById('testCards');
  const searchInput = document.getElementById('searchInput');
  const expandAllButton = document.getElementById('expandAll');
  const collapseAllButton = document.getElementById('collapseAll');
  const downloadJsonButton = document.getElementById('downloadJson');
  const downloadPdfButton = document.getElementById('downloadPdf');
  const filterButtons = Array.from(document.querySelectorAll('button[data-filter]'));
  const reportDataElement = document.getElementById('report-data');

  if (!cardsContainer) {
    return;
  }

  const cards = Array.from(cardsContainer.querySelectorAll('.test-card'));
  let activeFilter = 'all';

  function normalizeText(value) {
    return String(value || '').toLowerCase();
  }

  function applyFilters() {
    const query = normalizeText(searchInput && searchInput.value);

    cards.forEach((card) => {
      const cardStatus = normalizeText(card.getAttribute('data-status'));
      const cardSearch = normalizeText(card.getAttribute('data-search'));

      const matchesStatus = activeFilter === 'all' || activeFilter === cardStatus;
      const matchesQuery = query.length === 0 || cardSearch.includes(query);

      card.style.display = matchesStatus && matchesQuery ? '' : 'none';
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.getAttribute('data-filter') || 'all';
      filterButtons.forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      applyFilters();
    });
  });

  if (expandAllButton) {
    expandAllButton.addEventListener('click', () => {
      const detailElements = document.querySelectorAll('.test-details');
      detailElements.forEach((element) => {
        element.open = true;
      });
    });
  }

  if (collapseAllButton) {
    collapseAllButton.addEventListener('click', () => {
      const detailElements = document.querySelectorAll('.test-details');
      detailElements.forEach((element) => {
        element.open = false;
      });
    });
  }

  if (downloadJsonButton && reportDataElement) {
    downloadJsonButton.addEventListener('click', () => {
      const jsonText = reportDataElement.textContent || '{}';
      const blob = new Blob([jsonText], { type: 'application/json' });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = 'enterprise-report.json';
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    });
  }

  if (downloadPdfButton) {
    downloadPdfButton.addEventListener('click', () => {
      window.print();
    });
  }

  applyFilters();
})();
