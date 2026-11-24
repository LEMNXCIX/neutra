export interface ICryptoProvider {
    randomBytes(size: number): string;
    /** RFC 4122 v4 identifier, used for anonymous UX identities. */
    randomUUID(): string;
}
