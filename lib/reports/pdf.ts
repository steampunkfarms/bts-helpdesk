import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { put } from '@vercel/blob'

const BTS_ORANGE = '#c2410c'
const DARK_TEXT = '#1a1a1a'
const GRAY_TEXT = '#6b7280'

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: DARK_TEXT,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: BTS_ORANGE,
    paddingBottom: 12,
  },
  brandName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: BTS_ORANGE,
  },
  headerRight: {
    textAlign: 'right',
  },
  clientName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: DARK_TEXT,
  },
  periodLabel: {
    fontSize: 10,
    color: GRAY_TEXT,
    marginTop: 2,
  },
  reportType: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: DARK_TEXT,
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: BTS_ORANGE,
    marginTop: 16,
    marginBottom: 6,
  },
  body: {
    fontSize: 10,
    lineHeight: 1.6,
    color: DARK_TEXT,
  },
  paragraph: {
    marginBottom: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: GRAY_TEXT,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
})

const REPORT_TYPE_LABELS: Record<string, string> = {
  monthly_summary: 'Monthly Service Summary',
  quarterly_priority: 'Quarterly Priority Report',
  semi_annual_savings: 'Semi-Annual Savings Analysis',
  annual_review: 'Annual Review',
}

function ReportDocument(props: {
  clientName: string
  periodLabel: string
  reportType: string
  narrative: string
}) {
  const { clientName, periodLabel, reportType, narrative } = props

  // Parse narrative into sections (split on lines that look like headers)
  const sections = parseNarrativeSections(narrative)

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'LETTER', style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.brandName }, 'Backcountry Tech Solutions'),
        React.createElement(
          View,
          { style: styles.headerRight },
          React.createElement(Text, { style: styles.clientName }, clientName),
          React.createElement(Text, { style: styles.periodLabel }, periodLabel),
        ),
      ),
      // Report title
      React.createElement(
        Text,
        { style: styles.reportType },
        REPORT_TYPE_LABELS[reportType] ?? reportType,
      ),
      // Body sections
      ...sections.map((section, i) =>
        React.createElement(
          View,
          { key: i },
          section.header
            ? React.createElement(Text, { style: styles.sectionHeader }, section.header)
            : null,
          ...section.paragraphs.map((p, j) =>
            React.createElement(Text, { key: j, style: [styles.body, styles.paragraph] }, p)
          ),
        )
      ),
      // Footer
      React.createElement(
        View,
        { style: styles.footer, fixed: true },
        React.createElement(Text, null, `Confidential — prepared for ${clientName}`),
        React.createElement(
          Text,
          { render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}` },
        ),
      ),
    ),
  )
}

function parseNarrativeSections(narrative: string): { header?: string; paragraphs: string[] }[] {
  const lines = narrative.split('\n')
  const sections: { header?: string; paragraphs: string[] }[] = []
  let current: { header?: string; paragraphs: string[] } = { paragraphs: [] }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Detect section headers (ALL CAPS, numbered headers, or markdown-style ##)
    const isHeader = /^#{1,3}\s+/.test(trimmed) ||
      /^\d+\.\s+[A-Z]/.test(trimmed) ||
      (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 80 && /[A-Z]/.test(trimmed))

    if (isHeader) {
      if (current.paragraphs.length > 0 || current.header) {
        sections.push(current)
      }
      current = {
        header: trimmed.replace(/^#{1,3}\s+/, '').replace(/^\d+\.\s+/, ''),
        paragraphs: [],
      }
    } else {
      current.paragraphs.push(trimmed)
    }
  }

  if (current.paragraphs.length > 0 || current.header) {
    sections.push(current)
  }

  return sections
}

export async function generateAndUploadPdf(params: {
  clientId: string
  clientName: string
  periodLabel: string
  reportType: string
  narrative: string
}): Promise<string> {
  const doc = ReportDocument({
    clientName: params.clientName,
    periodLabel: params.periodLabel,
    reportType: params.reportType,
    narrative: params.narrative,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(doc as any)

  const blobPath = `reports/${params.clientId}/${params.reportType}/${params.periodLabel.replace(/\s+/g, '-')}.pdf`

  const blob = await put(blobPath, buffer, {
    access: 'public',
    contentType: 'application/pdf',
  })

  return blob.url
}
