// Errors amb codi HTTP. El missatge es mostra a l'usuari: mai hi posis dades de respostes.

export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const unauthorized = (m = 'Cal iniciar la sessió amb el compte de l’escola.') => new HttpError(401, m)
export const forbidden = (m = 'No tens permís per fer aquesta acció.') => new HttpError(403, m)
export const notFound = (m = 'No s’ha trobat.') => new HttpError(404, m)
export const conflict = (m: string) => new HttpError(409, m)
export const invalid = (m: string) => new HttpError(400, m)
