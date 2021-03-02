import Store from '@/store/store';
import {LocalStorageVal} from '@/utilities/helper_util';
import {IStartupSettings, IUpdateUser, IUser} from '@heimdall/interfaces';
import axios from 'axios';
import Vue from 'vue';
import {
  Action,
  getModule,
  Module,
  Mutation,
  VuexModule
} from 'vuex-module-decorators';

const local_token = new LocalStorageVal<string | null>('authToken');
const localUserID = new LocalStorageVal<string | null>('localUserID');

export interface IServerState {
  serverMode: boolean;
  serverUrl: string;
  loading: boolean;
  token: string;
  banner: string;
  enabledOAuth: string[];
  oidcName: string;
  ldap: boolean;
  userInfo: IUser;
}

@Module({
  namespaced: true,
  dynamic: true,
  store: Store,
  name: 'ServerModule'
})
class Server extends VuexModule implements IServerState {
  banner = '';
  ldap = false;
  serverUrl = '';
  serverMode = false;
  loading = true;
  enabledOAuth: string[] = [];
  oidcName = '';
  /** Our currently granted JWT token */
  token = '';
  /** Provide a sane default for userInfo in order to avoid having to null check it all the time */
  userInfo: IUser = {
    id: '',
    email: '',
    firstName: '',
    lastName: '',
    title: '',
    role: '',
    organization: '',
    loginCount: -1,
    lastLogin: undefined,
    creationMethod: '',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  @Mutation
  SET_TOKEN(newToken: string) {
    this.token = newToken;
    local_token.set(newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  }

  @Mutation
  SET_USERID(newID: string) {
    localUserID.set(newID);
    this.userInfo.id = newID;
  }

  @Mutation
  SET_STARTUP_SETTINGS(settings: IStartupSettings) {
    this.banner = settings.banner;
    this.enabledOAuth = settings.enabledOAuth;
    this.oidcName = settings.oidcName;
    this.ldap = settings.ldap;
  }

  @Mutation
  SET_USER_INFO(info: IUser) {
    this.userInfo = info;
  }

  @Mutation
  SET_SERVER(server: string) {
    this.serverUrl = server;
    this.serverMode = true;
  }

  @Mutation
  SET_LOADING(loading: boolean) {
    this.loading = loading;
  }

  @Mutation
  CLEAR_TOKEN() {
    local_token.clear();
  }

  @Mutation
  CLEAR_USERID() {
    localUserID.clear();
  }

  /* Try to find the Heimdall-Server backend. We have configured the Vue dev server to
   * automatically proxy VUE_APP_API_URL, so all we need to do is check if we get a response
   * at /server.
   *
   * Returns null if no server is found, or the server URL if one is.
   */
  @Action
  public async CheckForServer() {
    // This is the only function that manipulates the loading state. If loading is already set
    // then we have already loaded the server information and there is no need to check again.
    if (!this.loading) {
      return null;
    }

    const potentialUrl = window.location.origin;

    return axios
      .get(`${potentialUrl}/server`)
      .then((response) => {
        if (response.status === 200) {
          // This means the server successfully responded and we are therefore in server mode
          this.context.commit('SET_SERVER', potentialUrl);
          this.context.commit('SET_STARTUP_SETTINGS', response.data);
          const token = local_token.get() || Vue.$cookies.get('accessToken');
          const userID = localUserID.get() || Vue.$cookies.get('userID');
          Vue.$cookies.remove('accessToken');
          Vue.$cookies.remove('userID');
          if (token !== null) {
            this.context.commit('SET_TOKEN', token);
          }
          if (userID !== null) {
            this.context.commit('SET_USERID', userID);
          }
          return this.GetUserInfo();
        }
      })
      .catch((_) => {
        // If a error code is received from the server, this means the app is not in server mode
        // and there is therefore no action is required.
      })
      .then((_) => {
        this.context.commit('SET_LOADING', false);
      });
  }
  @Action
  public async handleLogin(data: {userID: string; accessToken: string}) {
    this.context.commit('SET_USERID', data.userID);
    this.context.commit('SET_TOKEN', data.accessToken);
    this.GetUserInfo();
  }

  @Action({rawError: true})
  public async Login(userInfo: {email: string; password: string}) {
    return axios.post('/authn/login', userInfo).then((response) => {
      this.handleLogin(response.data);
    });
  }

  @Action({rawError: true})
  public async LoginLDAP(userInfo: {username: string; password: string}) {
    return axios.post('/authn/login/ldap', userInfo).then((response) => {
      this.handleLogin(response.data);
    });
  }

  @Action({rawError: true})
  public async LoginGithub(callbackCode: string | null) {
    return axios
      .get(`/authn/github/callback`, {
        params: {
          code: callbackCode
        }
      })
      .then((response) => {
        this.handleLogin(response.data);
      });
  }

  @Action({rawError: true})
  public async Register(userInfo: {
    email: string;
    password: string;
    passwordConfirmation: string;
    creationMethod: string;
  }) {
    return axios.post('/users', userInfo);
  }

  @Action({rawError: true})
  public async updateUserInfo(user: {
    id: string;
    info: IUpdateUser;
  }): Promise<IUser> {
    return axios.put<IUser>(`/users/${user.id}`, user.info).then(({data}) => {
      if (this.userInfo.id === data.id) {
        this.context.commit('SET_USER_INFO', data);
      }
      return data;
    });
  }

  @Action({rawError: true})
  public async GetUserInfo(): Promise<void> {
    if (this.userInfo.id) {
      return axios
        .get<IUser>(`/users/${this.userInfo.id}`)
        .then(({data}) => this.context.commit('SET_USER_INFO', data))
        .catch(() =>
          // If an error occurs fetching the users profile
          // then clear their token and refresh the page
          this.Logout()
        );
    }
  }

  @Action
  public Logout(): void {
    this.CLEAR_USERID();
    this.CLEAR_TOKEN();
    location.reload();
  }
}

export const ServerModule = getModule(Server);
