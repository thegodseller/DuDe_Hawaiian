export class QueryLimitError extends Error {
    constructor(message: string = 'Query limit exceeded') {
        super(message);
        this.name = 'QueryLimitError';
    }
}