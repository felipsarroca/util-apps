const safeName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

const capture = async (element: HTMLElement, scale = 2) => {
  const { default: html2canvas } = await import('html2canvas')
  return html2canvas(element, {
    backgroundColor: '#fffefa',
    logging: false,
    scale,
    useCORS: true,
    windowWidth: Math.max(element.scrollWidth, 1200),
  })
}

export async function downloadElementPng(
  element: HTMLElement,
  fileName: string,
) {
  const clone = element.cloneNode(true) as HTMLElement
  clone.classList.add('export-render')
  clone.style.position = 'fixed'
  clone.style.left = '-20000px'
  clone.style.top = '0'
  clone.style.width = '1400px'
  clone.style.maxWidth = 'none'
  document.body.appendChild(clone)
  try {
    const canvas = await capture(clone, 2)
    const link = document.createElement('a')
    link.download = `${safeName(fileName)}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } finally {
    clone.remove()
  }
}

export async function downloadElementsPdf(
  elements: HTMLElement[],
  fileName: string,
) {
  if (elements.length === 0) return

  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })
  const isBatch = elements.length > 10
  const captureScale = isBatch ? 0.72 : 1.25
  const imageQuality = isBatch ? 0.76 : 0.88

  for (let index = 0; index < elements.length; index += 1) {
    if (index > 0) pdf.addPage()
    const canvas = await capture(elements[index], captureScale)
    const image = canvas.toDataURL('image/jpeg', imageQuality)
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 8
    const availableWidth = pageWidth - margin * 2
    const availableHeight = pageHeight - margin * 2
    const ratio = Math.min(
      availableWidth / canvas.width,
      availableHeight / canvas.height,
    )
    const width = canvas.width * ratio
    const height = canvas.height * ratio
    pdf.addImage(
      image,
      'JPEG',
      (pageWidth - width) / 2,
      margin,
      width,
      height,
      undefined,
      'FAST',
    )
  }

  pdf.save(`${safeName(fileName)}.pdf`)
}

const svgToPng = async (svg: SVGSVGElement) => {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const sourceNodes = [svg, ...Array.from(svg.querySelectorAll('*'))]
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll('*'))]
  sourceNodes.forEach((node, index) => {
    const target = cloneNodes[index] as SVGElement
    const style = getComputedStyle(node)
    ;[
      'fill',
      'stroke',
      'stroke-width',
      'stroke-dasharray',
      'stroke-linecap',
      'stroke-linejoin',
      'font-family',
      'font-size',
      'font-weight',
      'opacity',
    ].forEach((property) => {
      const value = style.getPropertyValue(property)
      if (value) target.style.setProperty(property, value)
    })
  })

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const viewBox = clone.viewBox.baseVal
  const ratio =
    viewBox.width > 0 && viewBox.height > 0
      ? viewBox.height / viewBox.width
      : 0.75
  const width = 1500
  const height = Math.round(width * ratio)
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))

  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: 'image/svg+xml;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error("No s'ha pogut preparar el gràfic.")
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function downloadSvgPagesPdf(
  elements: HTMLElement[],
  fileName: string,
  heading: string,
) {
  if (elements.length === 0) return
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  for (let index = 0; index < elements.length; index += 1) {
    const svg = elements[index].querySelector<SVGSVGElement>('svg')
    if (!svg) continue
    if (index > 0) pdf.addPage()
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const studentName = elements[index].dataset.studentName ?? `Alumne ${index + 1}`
    pdf.setTextColor(0, 0, 0)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(20)
    pdf.text(studentName, pageWidth / 2, 14, { align: 'center' })
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(14)
    pdf.text(heading, pageWidth / 2, 27, { align: 'center' })

    const image = await svgToPng(svg)
    const availableWidth = pageWidth - 20
    const availableHeight = pageHeight - 42
    const viewBox = svg.viewBox.baseVal
    const imageRatio =
      viewBox.width > 0 && viewBox.height > 0
        ? viewBox.height / viewBox.width
        : 0.75
    let width = availableWidth
    let height = width * imageRatio
    if (height > availableHeight) {
      height = availableHeight
      width = height / imageRatio
    }
    pdf.addImage(
      image,
      'PNG',
      (pageWidth - width) / 2,
      32 + (availableHeight - height) / 2,
      width,
      height,
      undefined,
      'FAST',
    )
  }

  pdf.save(`${safeName(fileName)}.pdf`)
}
