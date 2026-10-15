
export function isRegistrationClosed(votingStart: string | null | undefined): boolean {
    if (!votingStart) {
        return false;
    }

    return Date.now() >= new Date(votingStart).getTime();
}
