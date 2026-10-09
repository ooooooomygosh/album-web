// Subscribe before requesting the initial value. A late invoke reply must not
// overwrite a newer broadcast, and a renderer reload must not cause an
// unhandled rejection or update an unmounted component.
export function subscribePetSnapshot(api, apply) {
  let alive = true, receivedBroadcast = false;
  const off = api?.onSnapshot?.((value) => {
    if (!alive || !value) return;
    receivedBroadcast = true;
    apply(value);
  });
  Promise.resolve().then(() => api?.getSnapshot?.()).then((value) => {
    if (alive && !receivedBroadcast && value) apply(value);
  }).catch(() => {
    // Keep the default / last visible pet; a later live snapshot can recover
    // from IPC teardown or temporary main-process initialization failure.
  });
  return () => { alive = false; off?.(); };
}
