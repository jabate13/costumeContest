export type PartyPhase = 'registration' | 'voting' | 'finished';

export interface PartySchedule {
    voting_start: string | null;
    voting_end: string | null;
}

export function getPartyPhase(party: PartySchedule, now = Date.now()): PartyPhase {
    if (!party.voting_start) {
        return 'registration';
    }

    if (now < new Date(party.voting_start).getTime()) {
        return 'registration'
    }

    if (!party.voting_end) {
        return 'voting';
    }

    if (now < new Date(party.voting_end).getTime()) {
        return 'voting';
    }

    return 'finished';
}