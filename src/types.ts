export type CellType = string | number
export type Dimension = 'ROWS' | 'COLUMNS'
export type YearGroup = 7 | 8 | 9 | 10
export type Unit = 'metre' | 'second'
export enum SportEventName {
    LongJump = 'longJump',
    HighJump = 'highJump',
    Shot = 'shot',
    Javelin = 'javelin',
    Run100 = '100m',
    Run200 = '200m',
    Run300 = '300m',
    Run800 = '800m',
    Run1500 = '1500m',
    Run4x100 = '4x100m',
    Run4x300 = '4x300m'
}

export interface SportEvent {
    db: SportEventName
    pretty: string
    scored: 'abc' | 'overall' // ??
    startingCol: number
    subs: 'a' | 'b' | 'c'
    units: Unit
}

export interface Form {
    year: YearGroup
    form: string
}

export interface YearGroupRecordSummary {
    recordsBroken: number
    recordsEqualled: number
    year: string
}

export interface FormResults {
    eventDb: SportEventName
    eventPretty: string
    posA?: number
    posB?: number
    posC?: number
    ptsA?: number
    ptsB?: number
    ptsC?: number
    ptsRB?: number
    ptsTOTAL?: number
}

export interface SubeventFormResult {
    letter: string
    pos?: number | ''
    pts?: number | ''
}

export interface EventResults {
    a: SubeventFormResult[]
    b: SubeventFormResult[]
    c: SubeventFormResult[]
    rb: Omit<SubeventFormResult, "pos">[]
    total: Omit<SubeventFormResult, "pos">[]
}

export interface SummaryResults extends Form {
    schoolPos?: number
    yearPos?: number
    points?: number
}

export interface BonusPointAllocations {
    noRecord: CellType
    equal: CellType
    beat: CellType
}

export interface EventRecordStanding {
    currentForm?: string
    currentHolder?: string
    currentScore?: number
    currentYear?: number
    doScore: number
    event: SportEventName
    standingHolder: string
    standingScore: number
    standingYear: number
    units: Unit
}
