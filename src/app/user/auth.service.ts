import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, shareReplay, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { User } from './user.model';
import { JwtHelperService } from '@auth0/angular-jwt';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiServerUrl = environment.apiBaseUrl;

  private _isLoggedIn$ = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this._isLoggedIn$.asObservable();

  private _user$ = new BehaviorSubject<any>(null);
  public user$: Observable<any> = this._user$.asObservable();

  public TOKEN_NAME!: string;
  private SOAccessToken!: string;
  private SOKey = 'ZAeo5W0MnZPxiEBgb99MvA(('

  constructor(
    private http: HttpClient,
    private jwtHelper: JwtHelperService
  ) {
    if (this.token) {
      this.TOKEN_NAME = this.getTokenName(this.token);
      this.loadCurrentUser();
    }

  }

  get token(): any {
    return localStorage.getItem('jwt_access_token') || localStorage.getItem('gh_access_token') || localStorage.getItem('so_access_token');
  }

  /** This one is to access the jwt by this class for the jwtHelper lib tokenGetter function in the app.module */
  static get token(): any {
    return localStorage.getItem('jwt_access_token');
  }

  private getTokenName(tokenValue: string): string {
    let name = '';
    for (var i = 0, len = localStorage.length; i < len; i++) {
      const key = localStorage.key(i)!;
      const value = localStorage[key];
      if (value === tokenValue) name = key;
    }
    return name
  }

  private loadCurrentUser() {
    if (this.TOKEN_NAME === 'jwt_access_token') {
      const isTokenExpired = this.jwtHelper.isTokenExpired(this.token);
      const usr = this.getJWTuser(this.token);
      this._isLoggedIn$.next(!isTokenExpired);
      this._user$.next(usr);
      console.log('AUTH CTOR CHECK CURR USER: ', this.user$);

    } else if (this.TOKEN_NAME === 'gh_access_token') {
      this._isLoggedIn$.next(!!this.token);
      this.getGHUser().pipe(
        tap(usr => {
          console.log('Fetching GH user...');
          this._user$.next(usr)
          console.log('AUTH CTOR CHECK CURR USER: ', this.user$);
        })
      )
    } else {
      this._isLoggedIn$.next(!!this.token);
      this.getSOUser(this.SOKey, this.SOAccessToken).pipe(
        tap(usr => {
          console.log('Fetching SO user...');
          this._user$.next(usr)
          console.log('AUTH CTOR CHECK CURR USER: ', this.user$);
        })
      )
    }
  }

  public login(credentials: FormData): Observable<any> {
    return this.http.post<any>(`${this.apiServerUrl}/auth`, credentials, {
      observe: 'response'
    }).pipe(
      tap((response: any) => {
        this.handleJWTauth(response, 'jwt_access_token');
      }),
      shareReplay()
    );
  }

  public signup(credentials: FormData): Observable<User> {
    return this.http.post<User>(`${this.apiServerUrl}/user`, credentials, {
      observe: 'response'
    }).pipe(
      tap((response: any) => {
        this.handleJWTauth(response, 'jwt_access_token');
      }),
      shareReplay()
    )
  }

  public logout() {
    this._isLoggedIn$.next(false);
    this._user$.next(null);
    localStorage.removeItem(this.TOKEN_NAME);
  }

  public requestPasswordReset(email: string): Observable<any> {
    return this.http.get<any>(`${this.apiServerUrl}/user/initPasswordReset?email=${email}`, {
      responseType: 'text' as 'json'
    })
  }

  public verifyTokenForPasswordReset(token: string): Observable<any> {
    return this.http.get<any>(`${this.apiServerUrl}/user/verifyTokenForPasswordReset?token=${token}`)
  }

  public savePasswordReset(values: FormData): Observable<any> {
    return this.http.post<any>(`${this.apiServerUrl}/user/savePasswordReset`, values, {
      responseType: 'text' as 'json'
    })
  }

  public registrationConfirm(token: string): Observable<any> {
    return this.http.get<any>(`${this.apiServerUrl}/user/registrationConfirm?token=${token}`, {
      responseType: 'text' as 'json'
    })
  }

  public resendUserConfirm(email: string): Observable<any> {
    return this.http.get<any>(`${this.apiServerUrl}/user/resendRegistrationConfirm?email=${email}`, {
      responseType: 'text' as 'json'
    })
  }

  public getGithubAccessTokenFromCode(code: string): Observable<any> {
    return this.http.post<any>(`${this.apiServerUrl}/user/github/accessToken?code=${code}`, {}, {
      observe: 'response'
    }).pipe(
      tap((response: any) => {
        this.handleJWTauth(response, 'gh_access_token');
      }),
      shareReplay()
    )
  }

  public getGHUser(): Observable<any> {
    return this.http.get<any>('https://api.github.com/user');
  }

  public SOLogin(accessToken: string) {
    this.TOKEN_NAME = 'so_access_token';
    this._isLoggedIn$.next(true);
    this.SOAccessToken = accessToken;
  }

  public getSOUser(soKey: string, accessToken: string): Observable<any> {
    return this.http.get<any>(`https://api.stackexchange.com/me?key=${soKey}&site=stackoverflow&order=desc&sort=reputation&access_token=${accessToken}&filter=default`);
  }

  private handleJWTauth(response: any, tokenName: string) {
    const token = this.extractTokenFromHeaders(response)
    this.TOKEN_NAME = tokenName;
    this._isLoggedIn$.next(true) // Emit the token received as the new value of the _isLoggedIn observale with the tap side effect function
    localStorage.setItem(this.TOKEN_NAME, token);
  }

  private extractTokenFromHeaders(response: any) {
    return response.headers.get('authorization').split(' ')[1]
  }

  private getJWTuser(token: string): User {
    if (!token) {
      return null!
    }
    return JSON.parse(atob(token.split('.')[1])) as User;
  }
}

