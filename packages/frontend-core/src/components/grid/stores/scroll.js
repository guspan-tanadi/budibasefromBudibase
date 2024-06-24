import { writable, derived, get } from "svelte/store"
import { tick } from "svelte"
import { Padding, GutterWidth, FocusedCellMinOffset } from "../lib/constants"
import { parseCellID } from "../lib/utils"

export const createStores = () => {
  const scroll = writable({
    left: 0,
    top: 0,
  })

  // Derive height and width as primitives to avoid wasted computation
  const scrollTop = derived(scroll, $scroll => $scroll.top, 0)
  const scrollLeft = derived(scroll, $scroll => $scroll.left, 0)

  return {
    scroll,
    scrollTop,
    scrollLeft,
  }
}

export const deriveStores = context => {
  const {
    rows,
    visibleColumns,
    displayColumn,
    rowHeight,
    width,
    height,
    buttonColumnWidth,
  } = context

  // Memoize store primitives
  const stickyWidth = derived(displayColumn, $displayColumn => {
    return ($displayColumn?.width || 0) + GutterWidth
  })

  // Derive vertical limits
  const contentHeight = derived(
    [rows, rowHeight],
    ([$rows, $rowHeight]) => ($rows.length + 1) * $rowHeight + Padding
  )
  const maxScrollTop = derived(
    [height, contentHeight],
    ([$height, $contentHeight]) => Math.max($contentHeight - $height, 0)
  )

  // Derive horizontal limits
  const contentWidth = derived(
    [visibleColumns, buttonColumnWidth],
    ([$visibleColumns, $buttonColumnWidth]) => {
      const space = Math.max(Padding, $buttonColumnWidth - 1)
      let width = GutterWidth + space
      $visibleColumns.forEach(col => {
        width += col.width
      })
      return width
    }
  )
  const screenWidth = derived(
    [width, stickyWidth],
    ([$width, $stickyWidth]) => {
      return $width + $stickyWidth
    }
  )
  const maxScrollLeft = derived(
    [contentWidth, screenWidth],
    ([$contentWidth, $screenWidth]) => {
      return Math.max($contentWidth - $screenWidth, 0)
    }
  )

  // Derive whether to show scrollbars or not
  const showVScrollbar = derived(
    [contentHeight, height],
    ([$contentHeight, $height]) => {
      return $contentHeight > $height
    }
  )
  const showHScrollbar = derived(
    [contentWidth, screenWidth],
    ([$contentWidth, $screenWidth]) => {
      return $contentWidth > $screenWidth
    }
  )

  return {
    stickyWidth,
    contentHeight,
    contentWidth,
    screenWidth,
    maxScrollTop,
    maxScrollLeft,
    showHScrollbar,
    showVScrollbar,
  }
}

export const initialise = context => {
  const {
    focusedCellId,
    focusedRow,
    scroll,
    bounds,
    rowHeight,
    stickyWidth,
    scrollTop,
    maxScrollTop,
    scrollLeft,
    maxScrollLeft,
    buttonColumnWidth,
    columnLookupMap,
  } = context

  // Ensure scroll state never goes invalid, which can happen when changing
  // rows or tables
  const overscrollTop = derived(
    [scrollTop, maxScrollTop],
    ([$scrollTop, $maxScrollTop]) => $scrollTop > $maxScrollTop,
    false
  )
  const overscrollLeft = derived(
    [scrollLeft, maxScrollLeft],
    ([$scrollLeft, $maxScrollLeft]) => $scrollLeft > $maxScrollLeft,
    false
  )
  overscrollTop.subscribe(overscroll => {
    if (overscroll) {
      scroll.update(state => ({
        ...state,
        top: get(maxScrollTop),
      }))
    }
  })
  overscrollLeft.subscribe(overscroll => {
    if (overscroll) {
      scroll.update(state => ({
        ...state,
        left: get(maxScrollLeft),
      }))
    }
  })

  // Ensure the selected cell is visible
  focusedCellId.subscribe(async $focusedCellId => {
    await tick()
    const $focusedRow = get(focusedRow)
    const $scroll = get(scroll)
    const $bounds = get(bounds)
    const $rowHeight = get(rowHeight)

    // Ensure vertical position is viewable
    if ($focusedRow) {
      // Ensure row is not below bottom of screen
      const rowYPos = $focusedRow.__idx * $rowHeight
      const bottomCutoff =
        $scroll.top + $bounds.height - $rowHeight - FocusedCellMinOffset
      let delta = rowYPos - bottomCutoff
      if (delta > 0) {
        scroll.update(state => ({
          ...state,
          top: state.top + delta,
        }))
      }

      // Ensure row is not above top of screen
      else {
        const delta = $scroll.top - rowYPos + FocusedCellMinOffset
        if (delta > 0) {
          scroll.update(state => ({
            ...state,
            top: Math.max(0, state.top - delta),
          }))
        }
      }
    }

    // Ensure horizontal position is viewable
    // Check horizontal position of columns next
    const { field } = parseCellID($focusedCellId)
    const column = get(columnLookupMap)[field]
    if (!column) {
      return
    }

    // Ensure column is not cutoff on left edge
    const $stickyWidth = get(stickyWidth)
    let delta =
      $scroll.left - column.__left + FocusedCellMinOffset + $stickyWidth
    if (delta > 0) {
      scroll.update(state => ({
        ...state,
        left: Math.max(0, state.left - delta),
      }))
    }

    // Ensure column is not cutoff on right edge
    else {
      const $buttonColumnWidth = get(buttonColumnWidth)
      const rightEdge = column.__left + column.width
      const rightBound =
        $bounds.width + $scroll.left - FocusedCellMinOffset - $buttonColumnWidth
      delta = rightEdge - rightBound - $stickyWidth
      if (delta > 0) {
        scroll.update(state => ({
          ...state,
          left: state.left + delta,
        }))
      }
    }
  })
}
