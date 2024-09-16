import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { SeoService } from 'src/app/services/seo.service';
import { calcReadingTime, capitalizeString, formatDate } from 'src/app/services/utilities.service';
import { environment } from 'src/environments/environment';
import { Article } from '../article.model';
import { ArticleService } from '../article.service';
import { BehaviorSubject, of, Subscription, Observable } from 'rxjs';
import { AuthService } from 'src/app/user/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { DeleteArticlePopupComponent } from '../delete-article-popup/delete-article-popup.component';
import { MessageService } from 'src/app/services/message.service';
import { LoadEnvService } from 'src/app/services/load-env.service';
import { isPlatformBrowser } from '@angular/common';
import { MediaMatcher } from '@angular/cdk/layout';
import { JsonLdService } from 'ngx-seo';
import { JsonLd } from 'ngx-seo/lib/json-ld';
import { SlugUrlPipe } from 'src/app/shared/pipes/slug-url.pipe';
import { Location } from '@angular/common';
import { User } from 'src/app/user/user.model';

@Component({
  selector: 'app-article-detail',
  templateUrl: './article-detail.component.html',
  styleUrls: ['./article-detail.component.css']
})
export class ArticleDetailComponent implements OnInit, OnDestroy {
  
  readonly blogUrl = environment.blogUrl;
  readonly activeCourseModule = environment.courseRoutesActive === 'true';
  prod = this.blogUrl.startsWith('https://dev.') ? false : true;
  siteUrl = this.prod ? "https://zerofiltre.tech" : "https://dev.zerofiltre.tech"

  public article!: Article;
  public articleId!: string;
  public similarArticles!: Article[];
  public articleHasTags!: boolean;
  public loading!: boolean;
  private isPublished = new BehaviorSubject<any>(null);
  public isPublished$ = this.isPublished.asObservable();

  public nberOfViews$: Observable<any>;

  private nberOfReactions = new BehaviorSubject<number>(0);
  public nberOfReactions$ = this.nberOfReactions.asObservable();
  public typesOfReactions = <any>[
    { action: 'clap', emoji: '👏' },
    { action: 'fire', emoji: '🔥' },
    { action: 'love', emoji: '💖' },
    { action: 'like', emoji: '👍' },
  ];

  private fireReactions = new BehaviorSubject<number>(0);
  public fireReactions$ = this.fireReactions.asObservable();
  private clapReactions = new BehaviorSubject<number>(0);
  public clapReactions$ = this.clapReactions.asObservable();
  private loveReactions = new BehaviorSubject<number>(0);
  public loveReactions$ = this.loveReactions.asObservable();
  private likeReactions = new BehaviorSubject<number>(0);
  public likeReactions$ = this.likeReactions.asObservable();

  public articleSub!: Subscription;
  public loginToAddReaction!: boolean;
  public maxNberOfReaction!: boolean;
  public hasHistory: boolean;

  mobileQuery: MediaQueryList;
  currentVideoId: string;

  giscusConfig = {
    'data-repo': 'zero-filtre/zerofiltre-blog',
    'data-repo-id': 'R_kgDOGhkG4Q',
    'data-category': 'Announcements',
    'data-category-id': 'DIC_kwDOGhkG4c4CW2nQ',
    'data-mapping': 'title',
    'data-strict': '0',
    'data-reactions-enabled': '1',
    'data-emit-metadata': '0',
    'data-input-position': 'none',
    'data-theme': 'light',
    'data-lang': 'fr',
    'data-loading': 'lazy',
    'crossorigin': 'anonymous',
  }

  constructor(
    private loadEnvService: LoadEnvService,
    private dialogRef: MatDialog,
    private route: ActivatedRoute,
    private articleService: ArticleService,
    private seo: SeoService,
    public jsonLd: JsonLdService,
    private router: Router,
    public authService: AuthService,
    public messageService: MessageService,
    public slugify: SlugUrlPipe,
    private location: Location,
    media: MediaMatcher,
    changeDetectorRef: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: any
  ) {
    this.hasHistory = this.router.navigated;

    this.mobileQuery = media.matchMedia('(max-width: 1024px)');
    this._mobileQueryListener = () => changeDetectorRef.detectChanges();
    this.mobileQuery.addListener(this._mobileQueryListener);
  }

  private _mobileQueryListener: () => void;

  canAccesPremium(article: Article) {
    const user = this.authService?.currentUsr as User
    return this.articleService.canAccesPremium(user, article);
  }







  isValidURL(url: string) {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  extractVideoId(videoLink: string) {
    if (!videoLink) return;
    if(!this.isValidURL(videoLink)) return;
    const params = new URL(videoLink).searchParams;
    this.currentVideoId = params.get('v');
  }

  public setDateFormat(date: any) {
    return formatDate(date)
  }

  public trimAuthorName(name: string | any) {
    return name?.replace(/ /g, '');
  }

  public getCurrentArticle(articleId: string): void {
    this.loading = true;
    this.articleService.findArticleById(articleId)
      .pipe(
        tap(art => {
          if (art.status === 'PUBLISHED') {
            this.isPublished.next(true);
            this.incrementNberOfViews(this.articleId);
          } else {
            this.isPublished.next(false);
          }
        })
      )
      .subscribe({
        next: (response: Article) => {
          this.article = response
          this.extractVideoId(response.video)

          const rootUrl = this.router.url.split('/')[1];
          const sluggedUrl = `${rootUrl}/${this.slugify.transform(response)}`
          this.location.replaceState(sluggedUrl);

          this.seo.generateTags({
            title: response.title,
            description: response.summary,
            image: response.thumbnail,
            author: response.author?.fullName,
            publishDate: response.publishedAt?.substring(0, 10)
          })

          const dataSchema = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": response.title,
            "image": [response.thumbnail],
            "datePublished": response.publishedAt,
            "dateModified": response.lastPublishedAt,
            "author": [{
              "@type": "Person",
              "name": response.author.fullName,
              "jobTitle": response.author.profession,
              "url": `${this.siteUrl}/user/${response.author.id}`
            }]
          } as JsonLd | any

          this.jsonLd.setData(dataSchema)

          this.nberOfReactions.next(response?.reactions?.length);
          this.fireReactions.next(this.findTotalReactionByAction('FIRE', response?.reactions));
          this.clapReactions.next(this.findTotalReactionByAction('CLAP', response?.reactions));
          this.loveReactions.next(this.findTotalReactionByAction('LOVE', response?.reactions));
          this.likeReactions.next(this.findTotalReactionByAction('LIKE', response?.reactions));

          this.articleHasTags = response?.tags.length > 0
          calcReadingTime(response);

          this.fetchSimilarArticles();
          this.loading = false;
        },
        error: (_error: HttpErrorResponse) => {
          this.loading = false;
          this.messageService.openSnackBarError("Oops cet article est n'existe pas 😣!", '');
          this.router.navigateByUrl('/articles');
        }
      })
  }

  public fetchSimilarArticles(): void {
    if (!this.article?.tags.length) return

    let randomTagIndex = Math.floor(Math.random() * this.article?.tags.length);
    let randomTagName = this.article?.tags[randomTagIndex]?.name

    const selectedArticles = <any>[]
    let filteredArticles = <any>[]

    this.articleService.findAllArticlesByTag(0, 20, randomTagName)
      .subscribe(({ content, numberOfElements }: any) => {
        if (numberOfElements > 1) {
          filteredArticles = content.filter((article: Article) => article.id !== this.article.id);

          const randomArticleIndex = Math.floor(Math.random() * filteredArticles.length);
          selectedArticles.push(filteredArticles[randomArticleIndex])

          const newRandomArticleIndex = Math.floor(Math.random() * filteredArticles.length);

          if (newRandomArticleIndex !== randomArticleIndex) {
            selectedArticles.push(filteredArticles[newRandomArticleIndex])
          }

          this.similarArticles = [...selectedArticles]
        } else {
          if (this.article?.tags.length == 1) {
            return;
          } else if ((this.article?.tags.length - 1) == randomTagIndex && randomTagIndex != 0) {
            randomTagIndex -= 1;
          } else {
            randomTagIndex += 1;
          }
          randomTagName = this.article?.tags[randomTagIndex]?.name

          this.articleService.findAllArticlesByTag(0, 20, randomTagName)
            .subscribe(({ content }: any) => {
              filteredArticles = content.filter((article: Article) => article.id !== this.article.id);

              if (filteredArticles.length) {
                const randomArticleIndex = Math.floor(Math.random() * filteredArticles.length);
                selectedArticles.push(filteredArticles[randomArticleIndex])

                const newRandomArticleIndex = Math.floor(Math.random() * filteredArticles.length);

                if (newRandomArticleIndex !== randomArticleIndex) {
                  selectedArticles.push(filteredArticles[newRandomArticleIndex])
                }

                this.similarArticles = [...selectedArticles]
              }
            })
        }
      })
  }

  public isAuthor(user: any, article: Article): boolean {
    return user?.id === article?.author?.id
  }

  public authorHasSocials(): boolean {
    return this.article?.author?.socialLinks.length > 0
  }

  public authorHasSocialLinkFor(platform: string): boolean {
    return this.article?.author?.socialLinks.some((profile: any) => profile.platform === platform && profile.link)
  }

  public authorPlatformLink(platform: string): string {
    return this.article?.author?.socialLinks.find((profile: any) => profile.platform === platform)?.link
  }

  public userHasAlreadyReactOnArticleFiftyTimes(): boolean {
    const artileReactions = this.article?.reactions;
    const currentUsr = this.authService?.currentUsr;
    return artileReactions.filter((reaction: any) => reaction?.authorId === currentUsr?.id).length === 49;
  }

  public findTotalReactionByAction(action: string, reactions: []): number {
    return reactions.filter((reaction: any) => reaction.action === action).length;
  }

  public addReaction(action: string): any {
    const currentUsr = this.authService?.currentUsr;

    if (!currentUsr) {
      this.loginToAddReaction = true;
      return;
    }
    if (this.userHasAlreadyReactOnArticleFiftyTimes()) {
      this.maxNberOfReaction = true;
      return;
    };

    this.articleService.addReactionToAnArticle(this.articleId, action).subscribe({
      next: (response) => {
        this.nberOfReactions.next(response.length);
        this.fireReactions.next(this.findTotalReactionByAction('FIRE', response));
        this.clapReactions.next(this.findTotalReactionByAction('CLAP', response));
        this.loveReactions.next(this.findTotalReactionByAction('LOVE', response));
        this.likeReactions.next(this.findTotalReactionByAction('LIKE', response));
      }
    });
  }

  public openArticleDeleteDialog(): void {
    this.dialogRef.open(DeleteArticlePopupComponent, {
      panelClass: 'delete-article-popup-panel',
      data: {
        id: this.articleId,
        history: this.router.url
      }
    });
  }

  public capitalize(str: string): string {
    return capitalizeString(str);
  }

  public incrementNberOfViews(aricleId: string) {
    this.nberOfViews$ = this.articleService.incrementViews(aricleId)
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(
      params => {
        const parsedParams = params.get('id')?.split('-')[0]
        this.articleId = parsedParams!;
        this.getCurrentArticle(this.articleId);
      }
    );

    if (isPlatformBrowser(this.platformId)) {
   
    }
  }

  ngOnDestroy(): void {
    if (this.articleSub) {
      this.articleSub.unsubscribe();
    }
  }

}
