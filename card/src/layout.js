// Keep icon-only actions centered; captions may reclaim space above the footer.
export function homeCallLayout(
  width,
  height,
  hasSelector = true,
  selectorWidth = 100,
  footerWidths = null,
) {
  // One-row cards reserve the same side controls in every phase.
  if (height < 120) {
    const padding = 6;
    const button = Math.max(
      24,
      Math.floor(Math.min(36, (height - 12) / 1.18, width - 112)),
    );
    return {
      short: true,
      compact: true,
      tiny: true,
      padding,
      footerPadding: padding,
      footerBottom: padding,
      controlWidths: { discard: 32, time: 44 },
      edgeFooter: false,
      selectorTop: height / 2 - 16,
      showLabel: false,
      labelSpace: 0,
      button,
      centerY: height / 2,
      visualHeight: height - 12,
      icon: Math.round(button * 0.56),
    };
  }
  const minimumButton = height <= 120 ? 24 : 52;
  const compact = width < 280 || height < 240,
    tiny = width < 200 || height < 200;
  const padding = tiny ? 8 : compact ? 12 : 20,
    selectorTop = tiny ? 6 : compact ? 8 : 10;
  // The selector occupies the upper corner, rather than a full-width header row.
  // Text selectors are 32px high; compact cards retain their 44px header.
  const selectorHeight = compact ? 44 : 32;
  const cornerX = Math.max(0, width / 2 - padding - selectorWidth);
  const cornerY = Math.max(0, height / 2 - selectorTop - selectorHeight - 1);
  const cornerLimit = hasSelector
    ? 2 * Math.max(26, Math.hypot(cornerX, cornerY) - 2)
    : height - 2 * padding;
  // Reserve both footer controls in every phase, including their hover area.
  // Timer content matches the native Discard button’s 12px padding + 1px border.
  const footer = footerWidths || {
    discard: compact ? 46 : 122,
    time: 67,
    borderX: 1,
    borderY: 1,
  };
  const narrow = width < 200;
  const labelSpace =
    2 *
    Math.max(
      0,
      width / 2 -
        padding -
        (footer.borderX ?? 1) -
        Math.max(footer.discard, footer.time) -
        8,
    );
  const showLabel = width >= 200 && height >= 220 && labelSpace >= 60;
  const edgeFooter = !hasSelector && !showLabel && compact;
  const footerPadding = edgeFooter ? 8 : padding;
  // The native 44px footer already supplies space below its text. Reclaim
  // the extra bottom padding on full-size caption cards, keeping side insets.
  const balancedFooter = showLabel && !compact;
  const footerBottom = balancedFooter ? 8 : footerPadding;
  // A two-line caption is centered in the 44px footer: its top is 38px
  // above the footer bottom. Leave 12px clear of the halo after rounding.
  const captionInset = balancedFooter ? (44 + 32) / 2 : 32;
  const captionGap = balancedFooter ? 12.5 : 8;
  const narrowClearance = narrow;
  const discardHeight = narrowClearance ? 32 : 44;
  const timerHeight = narrowClearance ? 24 : 32;
  const footerDistance = Math.min(
    ...[
      [footer.discard, discardHeight],
      [footer.time, timerHeight],
    ].map(([w, bottom]) =>
      Math.hypot(
        Math.max(0, width / 2 - padding - (footer.borderX ?? 1) - w),
        Math.max(0, height / 2 - footerBottom - (footer.borderY ?? 1) - bottom),
      ),
    ),
  );
  const footerLimit = Math.max(
    minimumButton,
    (2 * (footerDistance - 8)) / 1.18,
  );
  const controlWidths = {
    discard: narrowClearance ? 32 : footer.discard,
    time: footer.time - (edgeFooter ? 13 : 0),
  };
  const labelLimit = showLabel
    ? (height / 2 -
        footerBottom -
        (footer.borderY ?? 1) -
        captionInset -
        captionGap) /
      0.59
    : Infinity;
  let button = Math.floor(
    Math.max(
      minimumButton,
      Math.min(
        240,
        width * 0.56,
        cornerLimit,
        footerLimit,
        labelLimit,
        (height - 2 * padding) / 1.18,
      ),
    ),
  );
  let centerY = height / 2;
  if (!hasSelector) {
    // Find the largest action which clears the top, caption and footer controls.
    // Reserve the same controls in every state so starting or discarding cannot jump.
    const borderY = footer.borderY ?? 1,
      clearance = showLabel ? 8.5 : 8; // Keep 8px after subpixel rounding.
    const maximum = Math.floor(
      Math.min(
        // Preserve the accepted 97px small-card action rather than inventing
        // another diameter when compact footer controls free extra space.
        narrow ? 97 : 240,
        width * 0.56,
        (height - 2 * padding - 2 * borderY) / 1.18,
      ),
    );
    for (let candidate = maximum; candidate >= minimumButton; candidate--) {
      const radius = candidate * 0.59,
        minimumY = padding + borderY + radius;
      let maximumY = height - padding - borderY - radius;
      if (showLabel)
        maximumY = Math.min(
          maximumY,
          height -
            footerBottom -
            borderY -
            captionInset -
            Math.max(8.5, captionGap) -
            radius,
        );
      for (const [controlWidth, controlHeight] of [
        [controlWidths.discard, discardHeight],
        [controlWidths.time, timerHeight],
      ]) {
        const distanceX = Math.max(
          0,
          width / 2 - footerPadding - (footer.borderX ?? 1) - controlWidth,
        );
        if (distanceX < radius + clearance)
          maximumY = Math.min(
            maximumY,
            height -
              footerBottom -
              borderY -
              controlHeight -
              Math.sqrt((radius + clearance) ** 2 - distanceX ** 2),
          );
      }
      if (
        minimumY <= maximumY &&
        (showLabel || (minimumY <= height / 2 && maximumY >= height / 2))
      ) {
        button = candidate;
        centerY = showLabel
          ? Math.max(minimumY, Math.min(height / 2, maximumY))
          : height / 2;
        break;
      }
    }
  }
  if (narrow && height === 120) {
    // Use the compact controls' real footprint at narrow widths, but stop
    // growing at the diameter supported by the regular controls at 200px.
    // This avoids both a tiny action and a shrink when the controls expand.
    button = Math.min(
      button,
      homeCallLayout(200, height, hasSelector, selectorWidth, {
        ...footer,
        time: footer.regularTime ?? footer.time,
      }).button,
    );
  }
  const visualHeight = Math.min(
    button * 1.44,
    height - 2 * padding,
    hasSelector
      ? Infinity
      : 2 *
          Math.min(
            centerY - padding - (footer.borderY ?? 1),
            height - padding - (footer.borderY ?? 1) - centerY,
          ),
  );
  return {
    compact,
    tiny,
    padding,
    footerPadding,
    footerBottom,
    controlWidths,
    edgeFooter,
    selectorTop,
    showLabel,
    labelSpace,
    button,
    centerY,
    visualHeight,
    icon: Math.round(button * 0.56),
  };
}
// The native popover stays within the visible part of its own card.
export function homeCallRecipientBounds(
  card,
  anchor,
  viewport,
  inset = 16,
  outside = false,
) {
  if (outside) {
    const width = Math.min(360, Math.max(320, card.width), viewport.width - 16);
    const below = viewport.height - anchor.bottom - 12;
    const above = anchor.top - 12;
    const maxHeight = Math.min(240, Math.max(below, above));
    if (maxHeight < 44) return null;
    return {
      left: Math.max(
        8,
        Math.min(anchor.right - width, viewport.width - width - 8),
      ),
      top: below >= above ? anchor.bottom + 4 : anchor.top - maxHeight - 4,
      width,
      maxHeight,
    };
  }
  const left = Math.max(card.left + inset, 8),
    right = Math.min(card.right - inset, viewport.width - 8);
  const top = Math.max(card.top + inset, 8),
    bottom = Math.min(card.bottom - inset, viewport.height - 8);
  const listTop = Math.max(top, anchor.bottom + 4),
    maxHeight = Math.min(240, bottom - listTop);
  if (right - left < 44 || maxHeight < 44) return null;
  return { left, top: listTop, width: right - left, maxHeight };
}
