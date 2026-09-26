import jsPDF from 'jspdf';

const ACCENT_CLASSES = {
  trust: { border: 'border-l-trust', dot: 'bg-trust' },
  risk: { border: 'border-l-risk', dot: 'bg-risk' },
  connection: { border: 'border-l-connection', dot: 'bg-connection' },
  danger: { border: 'border-l-danger', dot: 'bg-danger' },
};

function Section({ title, children, accent }) {
  const c = accent ? ACCENT_CLASSES[accent] : null;
  return (
    <div className={`bg-surface border border-border rounded-xl p-5 mb-5 ${c ? `border-l-4 ${c.border}` : ''}`}>
      <div className="flex items-center gap-2.5 mb-3">
        {c && <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />}
        <h3 className="font-display text-[15px] font-semibold m-0">{title}</h3>
      </div>
      <div className="text-sm text-gray-300 space-y-2">{children}</div>
    </div>
  );
}

const BADGE_CLASSES = {
  low: 'bg-surface2 text-gray-400',
  medium: 'bg-risk/15 text-risk',
  high: 'bg-trust/15 text-trust',
};

function generatePdf(report) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  function addLine(text, options = {}) {
    const { size = 11, bold = false, gap = 7 } = options;
    doc.setFontSize(size);
    doc.setFont(undefined, bold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += gap;
    });
  }

  function addSectionTitle(title) {
    y += 3;
    addLine(title, { size: 13, bold: true, gap: 8 });
  }

  addLine('TRACY Investigation Report', { size: 16, bold: true, gap: 10 });
  addLine(`Generated: ${new Date().toLocaleString()}`, { size: 9, gap: 8 });

  addSectionTitle('Subject');
  addLine(
    `${report.subject_type}${report.subject_platform ? ` (${report.subject_platform})` : ''} — ${report.subject_value}`
  );

  if (report.evidence?.length > 0) {
    addSectionTitle(`Evidence Submitted (${report.evidence.length})`);
    report.evidence.forEach((e) => addLine(`• [${e.type}] ${e.content || e.file_name}`));
  }

  addSectionTitle('Verified Facts');
  if (!report.verified_facts?.length) addLine('None found.');
  report.verified_facts?.forEach((f) => addLine(`• ${f.fact} (source: ${f.source})`));

  addSectionTitle('User-Provided Claims');
  report.user_claims?.forEach((c) => addLine(`• ${c.claim}`));

  if (report.contradictions?.length > 0) {
    addSectionTitle('Contradictions Detected');
    report.contradictions.forEach((c) =>
      addLine(`• Claim: "${c.subject_claim}" — Conflicts with: ${c.conflicts_with}. ${c.explanation}`)
    );
  }

  addSectionTitle('Possible Connections');
  report.possible_connections?.forEach((c) => addLine(`• ${c.connection} — ${c.reasoning}`));

  addSectionTitle('Risk Indicators');
  report.risk_indicators?.forEach((r) => addLine(`• ${r.indicator} — ${r.reasoning}`));

  addSectionTitle('Unknown Information');
  report.unknown_flags?.forEach((u) => addLine(`• ${u}`));

  addSectionTitle('Confidence Level');
  addLine(`${report.confidence_level?.level?.toUpperCase()} — ${report.confidence_level?.justification}`);

  addSectionTitle('Recommended Next Steps');
  report.recommended_next_steps?.forEach((s) => addLine(`• ${s}`));

  const safeSubject = (report.subject_value || 'investigation').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
  doc.save(`tracy-${safeSubject}-${Date.now()}.pdf`);
}

function ReportView({ report, onNewInvestigation }) {
  if (!report) return null;

  const level = report.confidence_level?.level || 'low';

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <h2 className="font-display text-xl font-semibold m-0">Investigation Report</h2>
        <button
          className="bg-surface2 border border-border text-gray-100 text-sm font-medium px-4 py-2 rounded-lg hover:bg-border/60 transition"
          onClick={() => generatePdf(report)}
        >
          Download PDF
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-5">
        Investigating: <strong className="text-gray-100 font-medium">{report.subject_type}</strong>
        {report.subject_platform && ` (${report.subject_platform})`} — {report.subject_value}
        {report.evidence?.length > 0 && ` · ${report.evidence.length} evidence item(s)`}
      </p>

      <Section title="Verified Facts" accent="trust">
        {report.verified_facts.length === 0 ? (
          <p className="text-gray-500">None found.</p>
        ) : (
          <ul className="space-y-2 list-disc list-inside">
            {report.verified_facts.map((f, i) => (
              <li key={i}>{f.fact} <span className="text-gray-500 text-xs">(source: {f.source})</span></li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="User-Provided Claims">
        <ul className="space-y-2 list-disc list-inside">
          {report.user_claims.map((c, i) => <li key={i}>{c.claim}</li>)}
        </ul>
      </Section>

      {report.contradictions?.length > 0 && (
        <Section title="Contradictions Detected" accent="danger">
          <ul className="space-y-3">
            {report.contradictions.map((c, i) => (
              <li key={i}>
                <div><span className="text-gray-100 font-medium">Claim:</span> "{c.subject_claim}"</div>
                <div><span className="text-gray-100 font-medium">Conflicts with:</span> {c.conflicts_with}</div>
                <div className="text-gray-500 text-xs mt-0.5">{c.explanation}</div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Possible Connections" accent="connection">
        <ul className="space-y-2">
          {report.possible_connections.map((c, i) => (
            <li key={i}>
              {c.connection}
              <div className="text-gray-500 text-xs mt-0.5">{c.reasoning}</div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Risk Indicators" accent="risk">
        <ul className="space-y-2">
          {report.risk_indicators.map((r, i) => (
            <li key={i}>
              {r.indicator}
              <div className="text-gray-500 text-xs mt-0.5">{r.reasoning}</div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Unknown Information">
        <ul className="space-y-2 list-disc list-inside">
          {report.unknown_flags.map((u, i) => <li key={i}>{u}</li>)}
        </ul>
      </Section>

      <Section title="Confidence Level">
        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${BADGE_CLASSES[level]}`}>
          {level.toUpperCase()}
        </span>
        <p className="mt-2.5">{report.confidence_level.justification}</p>
      </Section>

      <Section title="Recommended Next Steps">
        <ul className="space-y-2 list-disc list-inside">
          {report.recommended_next_steps.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </Section>

      <button
        className="w-full bg-trust text-[#06231F] font-medium py-3 rounded-lg hover:brightness-110 transition"
        onClick={onNewInvestigation}
      >
        Start New Investigation
      </button>
    </div>
  );
}

export default ReportView;
