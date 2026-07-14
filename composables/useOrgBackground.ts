/** Read the org's optional page-background setting (image + darkening overlay). */
export function useOrgBackground() {
  const { config } = useOrgConfig()
  const image = computed(() => config.value.background?.image ?? '')
  const hasBg = computed(() => !!image.value)
  const overlay = computed(() => config.value.background?.overlayOpacity ?? 0.5)
  return { hasBg, image, overlay }
}
