/**
 * Module toolbar spotlight: after the user picks a person/record, local
 * search UI must clear so the next search does not start with their name.
 * URL flush for the list filter is suppressed separately (navigation in flight).
 */
export function nextModuleSpotlightStateAfterSelect(): {
  searchQuery: string;
  liveResults: [];
  liveOpen: boolean;
} {
  return {
    searchQuery: '',
    liveResults: [],
    liveOpen: false,
  };
}
