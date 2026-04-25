export interface CommonHead {
    ERROR: boolean;
    CODE: string;
    MESSAGE: string;
}

export interface ApiResponse<T> {
    COMMON_HEAD: CommonHead;
    REC?: T;
}

export interface LoginResponseRec {
    TOKEN: string;
    TOKEN_TYPE: string;
    EXPIRES_IN: number;
    USER_ID: string;
    USER_NM: string;
    BIZ_KEY: string;
    LANG_CD: string;
    CMPN_NM: string;
}

export interface MeResponseRec {
    USER_ID: string;
    USER_NM: string;
    BIZ_KEY: string;
    LANG_CD: string;
    CMPN_NM: string;
}
