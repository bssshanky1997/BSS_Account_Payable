(function initializeEnterpriseReporter() {
  const cardsContainer = document.getElementById('testCards');
  const searchInput = document.getElementById('searchInput');
  const expandAllButton = document.getElementById('expandAll');
  const collapseAllButton = document.getElementById('collapseAll');
  const downloadJsonButton = document.getElementById('downloadJson');
  const downloadJsonTopButton = document.getElementById('downloadJsonTop');
  const downloadPdfButton = document.getElementById('downloadPdf');
  const heroLogsButton = document.getElementById('heroLogs');
  const heroScreenshotsButton = document.getElementById('heroScreenshots');
  const statusFilterButtons = Array.from(document.querySelectorAll('button[data-filter]'));
  const suiteFilterButtons = Array.from(document.querySelectorAll('button[data-suite-filter]'));
  const reportDataElement = document.getElementById('report-data');

  if (!cardsContainer) {
    return;
  }

  const cards = Array.from(cardsContainer.querySelectorAll('.test-card'));
  let activeStatusFilter = 'all';
  let activeSuiteFilter = 'all';

  function normalizeText(value) {
    return String(value || '').toLowerCase();
  }

  function applyFilters() {
    const query = normalizeText(searchInput && searchInput.value);

    cards.forEach((card) => {
      const cardStatus = normalizeText(card.getAttribute('data-status'));
      const cardSuite = normalizeText(card.getAttribute('data-suite'));
      const cardSearch = normalizeText(card.getAttribute('data-search'));

      const matchesStatus = activeStatusFilter === 'all' || activeStatusFilter === cardStatus;
      const matchesSuite = activeSuiteFilter === 'all' || activeSuiteFilter === cardSuite;
      const matchesQuery = query.length === 0 || cardSearch.includes(query);

      card.style.display = matchesStatus && matchesSuite && matchesQuery ? '' : 'none';
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  statusFilterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeStatusFilter = button.getAttribute('data-filter') || 'all';
      statusFilterButtons.forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      applyFilters();
    });
  });

  suiteFilterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeSuiteFilter = button.getAttribute('data-suite-filter') || 'all';
      suiteFilterButtons.forEach((item) => item.classList.remove('active'));
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
    const handleDownloadJson = () => {
      const jsonText = reportDataElement.textContent || '{}';
      const blob = new Blob([jsonText], { type: 'application/json' });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = 'enterprise-report.json';
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    };

    downloadJsonButton.addEventListener('click', handleDownloadJson);
    if (downloadJsonTopButton) {
      downloadJsonTopButton.addEventListener('click', handleDownloadJson);
    }
  }

  if (downloadPdfButton) {
    downloadPdfButton.addEventListener('click', () => {
      window.print();
    });
  }

  if (heroLogsButton) {
    heroLogsButton.addEventListener('click', () => {
      const logsHeading = Array.from(document.querySelectorAll('h4')).find(
        (heading) => heading.textContent && heading.textContent.toLowerCase().includes('logs')
      );
      logsHeading?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  if (heroScreenshotsButton) {
    heroScreenshotsButton.addEventListener('click', () => {
      const screenshotHeading = Array.from(document.querySelectorAll('h4')).find(
        (heading) => heading.textContent && heading.textContent.toLowerCase().includes('screenshots')
      );
      screenshotHeading?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  applyFilters();
})();
