/**
 * pdf-report.js — PDF Report Generator for TaskFlow
 * Uses jsPDF to generate professional task tracking reports
 */

const PDFReport = {

  // Color palette matching the app
  colors: {
    primary: [99, 102, 241],      // Indigo
    dark: [10, 10, 26],           // Background
    darkAlt: [18, 18, 42],        // Surface
    white: [255, 255, 255],
    textPrimary: [237, 237, 245],
    textSecondary: [156, 163, 175],
    green: [16, 185, 129],
    amber: [245, 158, 11],
    red: [239, 68, 68],
    blue: [59, 130, 246],
    border: [55, 55, 80]
  },

  /**
   * Generate and download the PDF report
   */
  generate(options = {}) {
    const { filter = 'all' } = options; // 'all', 'in_progress', 'paused', 'completed'

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // ── HEADER ──────────────────────────────────────
    // Dark header background
    doc.setFillColor(...this.colors.primary);
    doc.rect(0, 0, pageWidth, 35, 'F');

    // Logo circle
    doc.setFillColor(255, 255, 255);
    doc.circle(margin + 8, 17.5, 8, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...this.colors.primary);
    doc.text('TF', margin + 8, 19.5, { align: 'center' });

    // Title
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('TaskFlow — Reporte de Tareas', margin + 20, 15);

    // Date/time
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CL', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    doc.text(`Generado: ${dateStr} a las ${timeStr}`, margin + 20, 22);

    // Filter badge
    const filterLabels = { all: 'Todas', in_progress: 'En Proceso', paused: 'En Pausa', completed: 'Finalizadas' };
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const filterText = `Filtro: ${filterLabels[filter]}`;
    const filterWidth = doc.getTextWidth(filterText) + 6;
    doc.setFillColor(255, 255, 255, 0.3);
    doc.roundedRect(pageWidth - margin - filterWidth, 26, filterWidth, 6, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(filterText, pageWidth - margin - filterWidth + 3, 30);

    y = 42;

    // ── STATISTICS BAR ────────────────────────────────
    const stats = Store.getStats();
    const statItems = [
      { label: 'Total', value: stats.total, color: this.colors.primary },
      { label: 'En Proceso', value: stats.inProgress, color: this.colors.blue },
      { label: 'En Pausa', value: stats.paused, color: this.colors.amber },
      { label: 'Finalizadas', value: stats.completed, color: this.colors.green }
    ];

    const statBoxWidth = (contentWidth - 9) / 4; // 3px gap between 4 boxes
    statItems.forEach((stat, i) => {
      const x = margin + i * (statBoxWidth + 3);

      // Box background
      doc.setFillColor(245, 245, 250);
      doc.roundedRect(x, y, statBoxWidth, 16, 2, 2, 'F');

      // Left accent line
      doc.setFillColor(...stat.color);
      doc.rect(x, y + 2, 1.5, 12, 'F');

      // Value
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...stat.color);
      doc.text(String(stat.value), x + 8, y + 8);

      // Label
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 120);
      doc.text(stat.label, x + 8, y + 13);
    });

    y += 22;

    // ── GET TASKS ───────────────────────────────────
    let tasks = Store.getTasks();
    if (filter !== 'all') {
      tasks = tasks.filter(t => t.phase === filter);
    }

    if (tasks.length === 0) {
      doc.setFontSize(12);
      doc.setTextColor(150, 150, 170);
      doc.text('No hay tareas para mostrar con el filtro seleccionado.', pageWidth / 2, y + 20, { align: 'center' });
      doc.save(`TaskFlow_Reporte_${this._dateKey()}.pdf`);
      if (typeof UI !== 'undefined') UI.showToast('📄 PDF generado (sin tareas)', 'info');
      return;
    }

    // Group by phase
    const groups = [
      { phase: 'in_progress', label: '🔵 EN PROCESO', color: this.colors.blue, tasks: [] },
      { phase: 'paused', label: '🟡 EN PAUSA', color: this.colors.amber, tasks: [] },
      { phase: 'completed', label: '🟢 FINALIZADAS', color: this.colors.green, tasks: [] }
    ];

    tasks.forEach(t => {
      const group = groups.find(g => g.phase === t.phase);
      if (group) group.tasks.push(t);
    });

    // ── RENDER EACH GROUP ──────────────────────────
    groups.forEach(group => {
      if (group.tasks.length === 0) return;
      if (filter !== 'all' && group.phase !== filter) return;

      // Check if we need a new page
      if (y > pageHeight - 40) {
        doc.addPage();
        y = margin;
      }

      // Section header
      doc.setFillColor(...group.color);
      doc.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(`${group.label}  (${group.tasks.length})`, margin + 4, y + 5.5);
      y += 12;

      // Table header
      this._drawTableHeader(doc, margin, y, contentWidth);
      y += 7;

      // Task rows
      group.tasks.forEach((task, index) => {
        // Check page break
        const rowHeight = this._estimateRowHeight(doc, task, contentWidth);
        if (y + rowHeight > pageHeight - 15) {
          doc.addPage();
          y = margin;
          this._drawTableHeader(doc, margin, y, contentWidth);
          y += 7;
        }

        y = this._drawTaskRow(doc, task, margin, y, contentWidth, index);
      });

      y += 6;
    });

    // ── FOOTER ──────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      // Footer line
      doc.setDrawColor(200, 200, 210);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

      // Footer text
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 170);
      doc.text('TaskFlow — Seguimiento de Tareas', margin, pageHeight - 8);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }

    // ── SAVE ────────────────────────────────────────
    doc.save(`TaskFlow_Reporte_${this._dateKey()}.pdf`);

    if (typeof UI !== 'undefined') {
      UI.showToast('📄 Reporte PDF descargado ✓', 'success');
    }
  },

  /**
   * Draw the table header row
   */
  _drawTableHeader(doc, x, y, width) {
    doc.setFillColor(235, 235, 245);
    doc.roundedRect(x, y, width, 6, 1, 1, 'F');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 100);

    const cols = this._getColumns(width);
    doc.text('TAREA', x + cols.title.x, y + 4);
    doc.text('TICKETS', x + cols.tickets.x, y + 4);
    doc.text('RESPONSABLE', x + cols.assignee.x, y + 4);
    doc.text('PRIORIDAD', x + cols.priority.x, y + 4);
    doc.text('TIEMPO', x + cols.time.x, y + 4);
    doc.text('CREADA', x + cols.created.x, y + 4);
  },

  /**
   * Draw a single task row
   */
  _drawTaskRow(doc, task, x, y, width, index) {
    const cols = this._getColumns(width);
    const isEven = index % 2 === 0;

    // Row height depends on content
    const titleLines = doc.splitTextToSize(task.title || 'Sin título', cols.title.w - 2);
    const rowHeight = Math.max(8, titleLines.length * 3.5 + 3);

    // Row background (alternating)
    if (isEven) {
      doc.setFillColor(248, 248, 252);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(x, y, width, rowHeight, 'F');

    // Bottom border
    doc.setDrawColor(230, 230, 240);
    doc.setLineWidth(0.2);
    doc.line(x, y + rowHeight, x + width, y + rowHeight);

    // Priority color indicator
    const priorityColors = {
      high: [239, 68, 68],
      medium: [245, 158, 11],
      low: [16, 185, 129]
    };
    doc.setFillColor(...(priorityColors[task.priority] || priorityColors.medium));
    doc.rect(x, y + 1, 1.5, rowHeight - 2, 'F');

    // Title (with wrapping)
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 50);
    doc.text(titleLines, x + cols.title.x, y + 4.5);

    // Description (if any, below title)
    if (task.description) {
      const descLines = doc.splitTextToSize(task.description, cols.title.w - 2);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 140);
      doc.text(descLines.slice(0, 2), x + cols.title.x, y + 4.5 + titleLines.length * 3.5);
    }

    // Tickets
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    let ticketY = y + 4.5;
    if (task.incNumber) {
      doc.setTextColor(239, 68, 68);
      doc.text(`INC-${task.incNumber}`, x + cols.tickets.x, ticketY);
      ticketY += 3.5;
    }
    if (task.crqNumber) {
      doc.setTextColor(59, 130, 246);
      doc.text(`CRQ-${task.crqNumber}`, x + cols.tickets.x, ticketY);
    }
    if (!task.incNumber && !task.crqNumber) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 180, 195);
      doc.text('—', x + cols.tickets.x, y + 4.5);
    }

    // Assignee
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 80);
    const assigneeLines = doc.splitTextToSize(task.assignee || 'Sin asignar', cols.assignee.w - 2);
    doc.text(assigneeLines, x + cols.assignee.x, y + 4.5);

    // Priority
    const priorityLabels = { high: '🔴 Alta', medium: '🟡 Media', low: '🟢 Baja' };
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 80);
    doc.text(priorityLabels[task.priority] || 'Media', x + cols.priority.x, y + 4.5);

    // Time elapsed
    const elapsed = Timer.getElapsedMs(task);
    const timeStr = Timer.formatTime(elapsed, 'long');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(priorityColors[task.priority] || [60, 60, 80]));
    doc.text(timeStr, x + cols.time.x, y + 4.5);

    // Created date
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 140);
    if (task.createdAt) {
      const d = new Date(task.createdAt);
      doc.text(d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }), x + cols.created.x, y + 4.5);
      doc.text(d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }), x + cols.created.x, y + 7.5);
    }

    return y + rowHeight;
  },

  /**
   * Estimate how tall a row will be
   */
  _estimateRowHeight(doc, task, width) {
    const cols = this._getColumns(width);
    const titleLines = doc.splitTextToSize(task.title || '', cols.title.w - 2);
    return Math.max(8, titleLines.length * 3.5 + 3);
  },

  /**
   * Column definitions (x position and width)
   */
  _getColumns(totalWidth) {
    // Title: 30%, Tickets: 15%, Assignee: 18%, Priority: 12%, Time: 13%, Created: 12%
    const tw = totalWidth;
    return {
      title:    { x: 4,               w: tw * 0.28 },
      tickets:  { x: tw * 0.30,       w: tw * 0.14 },
      assignee: { x: tw * 0.45,       w: tw * 0.17 },
      priority: { x: tw * 0.63,       w: tw * 0.11 },
      time:     { x: tw * 0.74,       w: tw * 0.13 },
      created:  { x: tw * 0.88,       w: tw * 0.12 }
    };
  },

  /**
   * Generate date key for filename
   */
  _dateKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
};
