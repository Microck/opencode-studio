/**
 * Save before removing the old name. A failed save must never destroy the source.
 * If removal fails, retain both copies and let the caller report the failure.
 * @param {string} originalName
 * @param {string} requestedName
 * @param {(name: string) => Promise<unknown>} save
 * @param {(name: string) => Promise<unknown>} remove
 */
export async function saveRenamedResource(originalName, requestedName, save, remove) {
    const name = requestedName.trim();
    if (!name) throw new Error('Resource name is required');
    await save(name);
    if (name !== originalName) await remove(originalName);
}
