import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Article, Author, Tag } from './article.model';

@Injectable({
  providedIn: 'root'
})
export class ArticleService {
  readonly apiServerUrl = environment.apiBaseUrl;

  private articleSubject$ = new BehaviorSubject<Article[]>([]);
  public articles$: Observable<Article[]> = this.articleSubject$.asObservable();

  private tagSubject$ = new BehaviorSubject<Tag[]>([]);
  public tags$: Observable<Tag[]> = this.tagSubject$.asObservable();

  constructor(private http: HttpClient) { }

  public findAllArticles(page: number, limit: number, status: string): Observable<Article[]> {
    return this.http.get<any>(`${this.apiServerUrl}/article?pageNumber=${page}&pageSize=${limit}&status=${status}`)
      .pipe(
        map(({ content }) => content)
      );
  }

  public findArticleById(articleId: string): Observable<Article> {
    return this.http.get<Article>(`${this.apiServerUrl}/article/${articleId}`);
  }

  public addArticle(article: Article): Observable<Article> {
    return this.http.post<Article>(`${this.apiServerUrl}/article/add`, article);
  }

  public updateToSave(article: Article): Observable<Article> {
    return this.http.patch<Article>(`${this.apiServerUrl}/article`, article);
  }

  public updateToPublish(article: Article): Observable<Article> {
    return this.http.patch<Article>(`${this.apiServerUrl}/article/publish`, article);
  }

  public deleteArticle(articleId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiServerUrl}/article/delete/${articleId}`);
  }

  public getListOfTags(): Observable<Tag[]> {
    return this.http.get<Tag[]>(`${this.apiServerUrl}/tag`);
  }

  public getArticleTags(articleId: string): Observable<Tag[]> {
    return this.http.get<Tag[]>(`${this.apiServerUrl}/article/${articleId}/tags`);
  }

  public getArticleAuthor(articleId: string): Observable<Author[]> {
    return this.http.get<Author[]>(`${this.apiServerUrl}/article/${articleId}/author`);
  }

  public createArticle(title: string): Observable<Article> {
    return this.http.post<Article>(`${this.apiServerUrl}/article?title=${title}`, {})
  }
}
