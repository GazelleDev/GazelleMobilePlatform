import { escapeHtml } from "../ui/format.js";
import { getOverviewSnapshot } from "../overview-data.js";

export function renderOverviewSection() {
  const overview = getOverviewSnapshot();
  const chartBars = overview.chartBars
    .map(
      (bar) => `
        <div class="dash-bar-column">
          <div class="dash-bar ${bar.highlighted ? "dash-bar--active" : ""}" style="height: ${bar.height}%"></div>
          <span class="dash-bar-label">${escapeHtml(bar.label)}</span>
        </div>
      `
    )
    .join("");

  return `
    <section class="dash-overview">
      <div class="dash-kpi-row">
        ${overview.metrics
          .map(
            (metric) => `
              <article class="dash-kpi-card">
                <span class="dash-kpi-label">${escapeHtml(metric.label)}</span>
                <strong class="dash-kpi-value">${escapeHtml(metric.value)}</strong>
                <span class="dash-kpi-delta dash-kpi-delta--${metric.trend.tone}">${escapeHtml(metric.trend.text)}</span>
              </article>
            `
          )
          .join("")}
      </div>
      <section class="dash-chart-panel">
        <div class="dash-panel-header">
          <div class="dash-panel-title">Orders — Last 7 Days</div>
        </div>
        <div class="dash-chart-body">
          <div class="dash-bars">${chartBars}</div>
        </div>
      </section>
    </section>
  `;
}
