/**
 * AOE Code API 服务
 * 连接后端 api.aoecode.cn
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "https://api.aoecode.cn";

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

class ApiService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem("aoe_token", token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem("aoe_token");
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem("aoe_token");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        this.clearToken();
        window.location.href = "/login";
        return { success: false, error: "未授权" };
      }

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.detail || "请求失败" };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // 认证接口
  async login(email: string, password: string) {
    return this.request<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, username: string, password: string) {
    return this.request<{ token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, username, password }),
    });
  }

  async getMe() {
    return this.request("/auth/me");
  }

  // 卫星接口
  async getSatellites(params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params)}` : "";
    return this.request(`/v1/satellites${query}`);
  }

  async getSatellite(id: string) {
    return this.request(`/v1/satellites/${id}`);
  }

  async getSatelliteOrbits(id: string, params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params)}` : "";
    return this.request(`/v1/satellites/${id}/orbits${query}`);
  }

  // 知识库接口
  async getKnowledgeBases() {
    return this.request("/knowledge/bases");
  }

  async getKnowledgeBase(name: string) {
    return this.request(`/knowledge/bases/${name}`);
  }

  async searchKnowledge(query: string, base?: string) {
    const params = new URLSearchParams({ q: query });
    if (base) params.set("base", base);
    return this.request(`/knowledge/search?${params}`);
  }

  // 计费接口
  async getBalance() {
    return this.request("/v1/billing/balance");
  }

  async getConsumptionRecords() {
    return this.request("/v1/billing/consumption");
  }

  // 模型接口
  async getModels() {
    return this.request("/v1/models");
  }

  async chatCompletion(model: string, messages: any[], tools?: any[]) {
    return this.request("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ model, messages, tools }),
    });
  }

  // 报告接口
  async getReports() {
    return this.request("/v1/reports");
  }

  async generateReport(title: string, type: string, params: any) {
    return this.request("/v1/reports/generate", {
      method: "POST",
      body: JSON.stringify({ title, report_type: type, params }),
    });
  }
}

export const api = new ApiService();
export default api;