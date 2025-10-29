(function () {
    'use strict';

    const STORAGE_KEY = 'SURVEY_V1';
    const DEPARTMENTS = ['営業', '事務', 'システム', 'その他'];
    let departmentChartInstance = null;

    function getSurveyData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return [];
            }
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn('Failed to parse survey data', error);
            return [];
        }
    }

    function saveSurveyData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function addSurveyEntry(entry) {
        const data = getSurveyData();
        data.push(entry);
        saveSurveyData(data);
    }

    function resetSurveyData() {
        localStorage.removeItem(STORAGE_KEY);
    }

    function formatTimestamp(isoString) {
        if (!isoString) {
            return '';
        }
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) {
            return isoString;
        }
        return date.toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function sanitizeText(text) {
        return (text || '').replace(/[\n\r]+/g, ' ').trim();
    }

    function updateDepartmentTable(counts) {
        const tbody = document.querySelector('#department-table tbody');
        if (!tbody) {
            return;
        }
        tbody.innerHTML = '';
        Object.keys(counts).forEach((dept) => {
            const tr = document.createElement('tr');
            const nameTd = document.createElement('td');
            nameTd.textContent = dept;
            const countTd = document.createElement('td');
            countTd.textContent = String(counts[dept]);
            tr.appendChild(nameTd);
            tr.appendChild(countTd);
            tbody.appendChild(tr);
        });
    }

    function renderDepartmentChart(counts) {
        const canvas = document.getElementById('department-chart');
        const tableWrapper = document.getElementById('department-table-wrapper');

        if (!canvas || !tableWrapper) {
            return;
        }

        updateDepartmentTable(counts);

        const labels = Object.keys(counts);
        const values = labels.map((label) => counts[label]);

        const fallbackToTable = () => {
            canvas.classList.add('hidden');
            tableWrapper.classList.remove('hidden');
        };

        const displayChart = () => {
            tableWrapper.classList.add('hidden');
            canvas.classList.remove('hidden');
        };

        if (typeof window.Chart === 'undefined') {
            fallbackToTable();
            return;
        }

        try {
            const context = canvas.getContext('2d');
            if (!context) {
                fallbackToTable();
                return;
            }

            if (departmentChartInstance) {
                departmentChartInstance.destroy();
            }

            departmentChartInstance = new window.Chart(context, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        {
                            label: '件数',
                            data: values,
                            backgroundColor: '#93c5fd',
                            borderColor: '#2563eb',
                            borderWidth: 1,
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            precision: 0,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    }
                }
            });
            displayChart();
        } catch (error) {
            console.error('Failed to render chart', error);
            fallbackToTable();
        }
    }

    function renderDashboard() {
        const data = getSurveyData();
        const totalCountEl = document.getElementById('total-count');
        const averagePriorityEl = document.getElementById('average-priority');
        const recentListEl = document.getElementById('recent-list');

        if (totalCountEl) {
            totalCountEl.textContent = String(data.length);
        }

        if (averagePriorityEl) {
            if (data.length === 0) {
                averagePriorityEl.textContent = '0.0';
            } else {
                const totalPriority = data.reduce((sum, entry) => sum + Number(entry.priority || 0), 0);
                const average = totalPriority / data.length;
                averagePriorityEl.textContent = average.toFixed(1);
            }
        }

        const counts = DEPARTMENTS.reduce((acc, dept) => {
            acc[dept] = 0;
            return acc;
        }, {});

        data.forEach((entry) => {
            const dept = counts.hasOwnProperty(entry.department) ? entry.department : 'その他';
            counts[dept] += 1;
        });

        renderDepartmentChart(counts);

        if (recentListEl) {
            if (data.length === 0) {
                recentListEl.classList.add('list-empty');
                recentListEl.textContent = 'データがありません。';
            } else {
                recentListEl.classList.remove('list-empty');
                recentListEl.innerHTML = '';
                const recentItems = data
                    .slice()
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .slice(0, 5);

                recentItems.forEach((entry) => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'recent-entry';

                    const heading = document.createElement('h3');
                    heading.textContent = `${formatTimestamp(entry.timestamp)}｜${entry.department}｜優先度${entry.priority}`;

                    const issue = document.createElement('p');
                    const snippet = sanitizeText(entry.issue).slice(0, 20);
                    issue.textContent = snippet + (entry.issue && entry.issue.length > 20 ? '…' : '');

                    wrapper.appendChild(heading);
                    wrapper.appendChild(issue);
                    recentListEl.appendChild(wrapper);
                });
            }
        }
    }

    function convertToCsv(data) {
        const header = ['timestamp', 'department', 'role', 'priority', 'issue', 'contact'];
        const escapeCell = (value) => {
            const text = value == null ? '' : String(value);
            const escaped = text.replace(/"/g, '""');
            return `"${escaped}"`;
        };

        const rows = data.map((entry) => [
            entry.timestamp,
            entry.department,
            entry.role || '',
            entry.priority,
            sanitizeText(entry.issue),
            entry.contact ? 'はい' : 'いいえ'
        ].map(escapeCell).join(','));

        return [header.map(escapeCell).join(','), ...rows].join('\n');
    }

    function downloadCsv() {
        const data = getSurveyData();
        const csvContent = convertToCsv(data);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'survey_export.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function handleCsvDownload() {
        const button = document.getElementById('download-csv');
        if (!button) {
            return;
        }
        button.addEventListener('click', () => {
            downloadCsv();
        });
    }

    function handleResetButton() {
        const button = document.getElementById('reset-data');
        if (!button) {
            return;
        }
        button.addEventListener('click', () => {
            const confirmed = window.confirm('全データを削除しますか？');
            if (!confirmed) {
                return;
            }
            resetSurveyData();
            renderDashboard();
            alert('データをリセットしました。');
        });
    }

    function showFormMessage(element, message, type) {
        if (!element) {
            return;
        }
        element.textContent = message;
        element.className = type ? type : '';
    }

    function initFormPage() {
        const form = document.getElementById('survey-form');
        if (!form) {
            return;
        }
        const messageEl = document.getElementById('form-message');

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            const department = formData.get('department');
            const role = sanitizeText(formData.get('role'));
            const issue = sanitizeText(formData.get('issue'));
            const priorityValue = formData.get('priority');
            const contact = formData.get('contact') === 'on';

            const errors = [];

            if (!department) {
                errors.push('部署を選択してください。');
            }

            if (!issue) {
                errors.push('今日の困りごとを入力してください。');
            } else if (issue.length > 200) {
                errors.push('今日の困りごとは200文字以内で入力してください。');
            }

            const priority = Number(priorityValue);
            if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
                errors.push('優先度は1から5の数値で入力してください。');
            }

            if (errors.length > 0) {
                showFormMessage(messageEl, errors.join(' '), 'error');
                return;
            }

            const entry = {
                timestamp: new Date().toISOString(),
                department,
                role,
                priority,
                issue,
                contact
            };

            addSurveyEntry(entry);
            form.reset();
            showFormMessage(messageEl, '送信しました。ご協力ありがとうございます。', 'success');
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initFormPage();
        renderDashboard();
        handleCsvDownload();
        handleResetButton();
    });
})();
