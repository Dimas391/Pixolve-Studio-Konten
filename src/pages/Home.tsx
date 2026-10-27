import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Filter,
  FolderOpen,
  Grid2X2,
  Images,
  LayoutDashboard,
  Menu,
  MessageCircle,
  MoreHorizontal,
  PenLine,
  Plus,
  Search,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiDownload, apiGet, apiPatch, apiPost } from "@/lib/api";
import type {
  Asset,
  AssetProvider,
  Content,
  ContentStatus,
  DashboardSummary,
  Metrics,
} from "@/lib/types";

type Section = "overview" | "content" | "calendar" | "media" | "analytics";
type ContentForm = Omit<Content, "id" | "comments" | "created_at" | "updated_at">;

const pillars = ["Edukasi", "Promosi", "Soft Sell", "Entertainment", "FAQ"];
const platforms = [
  "Instagram Feed",
  "Instagram Reels",
  "Instagram Stories",
  "TikTok",
  "YouTube Shorts",
  "YouTube Long-form",
  "LinkedIn",
];
const statusLabels: Record<ContentStatus, string> = {
  idea: "Idea",
  scripting: "Scripting",
  in_production: "In production",
  pending_approval: "Needs review",
  scheduled: "Scheduled",
  published: "Published",
};
const statusColors: Record<ContentStatus, string> = {
  idea: "bg-[#F2ECE1] text-[#6B5A4E] border-[#E5DFD5]",
  scripting: "bg-[#FFF1DE] text-[#A34C13] border-[#FFD6AD]",
  in_production: "bg-[#E8F0FF] text-[#1E40AF] border-[#C7D7FF]",
  pending_approval: "bg-[#FFF4C7] text-[#8B5E00] border-[#F4D879]",
  scheduled: "bg-[#E1F3F1] text-[#176B68] border-[#B9DFDA]",
  published: "bg-[#E4F5E8] text-[#166534] border-[#B7E0C1]",
};
const providerLabels: Record<AssetProvider, string> = {
  google_drive: "Google Drive",
  dropbox: "Dropbox",
  canva: "Canva",
  figma: "Figma",
};
const providerColors: Record<AssetProvider, string> = {
  google_drive: "bg-[#E8F0FF] text-[#1E40AF]",
  dropbox: "bg-[#E2F0FF] text-[#0069C0]",
  canva: "bg-[#FFE9E1] text-[#D6421C]",
  figma: "bg-[#F4E9FF] text-[#8246AF]",
};

const blankMetrics: Metrics = {
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  engagement_rate: 0,
};
const blankForm: ContentForm = {
  title: "",
  description: "",
  pillar: "Edukasi",
  platforms: ["Instagram Feed"],
  status: "idea",
  approval_status: "not_submitted",
  caption: "",
  hashtags: "",
  cta: "",
  asset_url: "",
  scheduled_date: null,
  scheduled_time: null,
  metrics: blankMetrics,
};

function StatusPill({ status }: { status: ContentStatus }) {
  return (
    <span
      data-testid={`status-pill-${status}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide ${statusColors[status]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}

function PlatformChip({ platform }: { platform: string }) {
  const letter = platform.includes("Instagram")
    ? "◎"
    : platform.includes("TikTok")
      ? "♪"
      : platform.includes("YouTube")
        ? "▶"
        : "in";
  return (
    <span
      data-testid={`platform-chip-${platform.toLowerCase().replaceAll(" ", "-")}`}
      className="inline-flex items-center gap-1 rounded-sm bg-[#F7F1E7] px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-[#6B5A4E]"
    >
      <span className="font-bold text-[#FF5722]">{letter}</span>
      {platform.replace("Instagram ", "IG ").replace("YouTube ", "YT ")}
    </span>
  );
}

function formatDate(date: string | null) {
  if (!date) return "Not scheduled";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(
    new Date(`${date}T12:00:00`),
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Home() {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pillarFilter, setPillarFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContentForm>(blankForm);
  const [commentText, setCommentText] = useState("");
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [assetOpen, setAssetOpen] = useState(false);
  const [assetForm, setAssetForm] = useState({
    title: "",
    url: "",
    provider: "google_drive" as AssetProvider,
    kind: "Photo reference",
    notes: "",
  });
  const [monthCursor, setMonthCursor] = useState(() => new Date());

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardSummary>("/dashboard"),
    retry: false,
  });
  const contentsQuery = useQuery({
    queryKey: ["contents", statusFilter, pillarFilter, search],
    queryFn: () =>
      apiGet<Content[]>(
        `/contents?status=${encodeURIComponent(statusFilter)}&pillar=${encodeURIComponent(pillarFilter)}&search=${encodeURIComponent(search)}`,
      ),
    retry: false,
  });
  const assetsQuery = useQuery({
    queryKey: ["assets"],
    queryFn: () => apiGet<Asset[]>("/assets"),
    retry: false,
  });
  const dashboard = dashboardQuery.data;
  const contents = contentsQuery.data ?? [];
  const assets = assetsQuery.data ?? [];

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["contents"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () =>
      editingId
        ? apiPatch<Content>(`/contents/${editingId}`, form)
        : apiPost<Content>("/contents", form),
    onSuccess: (content) => {
      invalidate();
      setEditorOpen(false);
      setSelectedContent(content);
      toast.success(editingId ? "Content updated" : "Idea added to your plan");
    },
    onError: () => toast.error("Could not save this content yet"),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ContentForm> }) =>
      apiPatch<Content>(`/contents/${id}`, patch),
    onSuccess: (content) => {
      invalidate();
      setSelectedContent(content);
      toast.success("Workflow updated");
    },
    onError: () => toast.error("Workflow update failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/contents/${id}`),
    onSuccess: () => {
      invalidate();
      setSelectedContent(null);
      toast.success("Content removed");
    },
  });
  const commentMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      apiPost<Content>(`/contents/${id}/comments`, { author: "You", message }),
    onSuccess: (content) => {
      invalidate();
      setSelectedContent(content);
      setCommentText("");
      toast.success("Note added to the thread");
    },
  });
  const assetMutation = useMutation({
    mutationFn: () => apiPost<Asset>("/assets", assetForm),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assets"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setAssetOpen(false);
      setAssetForm({
        title: "",
        url: "",
        provider: "google_drive",
        kind: "Photo reference",
        notes: "",
      });
      toast.success("Asset link saved in MOCKED mode");
    },
    onError: () => toast.error("Add a valid asset link first"),
  });

  const openCreate = (template?: Partial<ContentForm>) => {
    setEditingId(null);
    setForm({ ...blankForm, ...template, metrics: blankMetrics });
    setEditorOpen(true);
  };
  const openEdit = (content: Content) => {
    setEditingId(content.id);
    setForm({
      title: content.title,
      description: content.description,
      pillar: content.pillar,
      platforms: content.platforms,
      status: content.status,
      approval_status: content.approval_status,
      caption: content.caption,
      hashtags: content.hashtags,
      cta: content.cta,
      asset_url: content.asset_url,
      scheduled_date: content.scheduled_date,
      scheduled_time: content.scheduled_time,
      metrics: content.metrics,
    });
    setEditorOpen(true);
  };
  const selectContent = (content: Content) => setSelectedContent(content);

  const monthDays = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    return [
      ...Array(first === 0 ? 6 : first - 1).fill(null),
      ...Array.from({ length: days }, (_, index) => new Date(year, month, index + 1)),
    ];
  }, [monthCursor]);
  const calendarContent = (date: Date) =>
    contents.filter((content) => content.scheduled_date === date.toISOString().slice(0, 10));

  const navItems: {
    id: Section;
    label: string;
    icon: typeof LayoutDashboard;
    count?: number | undefined;
  }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "content", label: "Content plan", icon: FileText, count: dashboard?.total_content },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "media", label: "Media library", icon: Images, count: dashboard?.media_assets },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  const navigate = (next: Section) => {
    setSection(next);
    setMobileNavOpen(false);
  };

  return (
    <div data-testid="cms-app-shell" className="min-h-screen bg-[#FAF7F2] text-[#2A1E17]">
      <aside
        data-testid="sidebar-navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col border-r border-[#E5DFD5] bg-[#F6F0E7] p-5 transition-transform duration-300 lg:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-start justify-between">
          <button
            data-testid="brand-home-button"
            onClick={() => navigate("overview")}
            className="group text-left"
          >
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-full bg-[#FF5722] text-lg font-black text-white shadow-[3px_3px_0_#2A1E17]">
                U
              </span>
              <span
                data-testid="brand-name"
                className="font-heading text-[19px] font-black uppercase tracking-[-0.06em]"
              >
                Union <i className="font-serif font-medium normal-case text-[#FF5722]">studio</i>
              </span>
            </div>
            <p
              data-testid="workspace-name"
              className="mt-3 pl-11 font-mono text-[10px] uppercase tracking-[0.2em] text-[#948275]"
            >
              Content workspace
            </p>
          </button>
          <button
            data-testid="mobile-close-navigation-button"
            onClick={() => setMobileNavOpen(false)}
            className="rounded-full p-2 text-[#6B5A4E] hover:bg-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>
        <div className="my-8 h-px bg-[#E5DFD5]" />
        <p
          data-testid="navigation-label"
          className="mb-3 px-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#948275]"
        >
          Workspace
        </p>
        <nav data-testid="primary-navigation" className="space-y-1">
          {navItems.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              data-testid={`navigation-${id}-button`}
              onClick={() => navigate(id)}
              className={`group flex w-full items-center justify-between rounded-sm px-3 py-3 text-left text-sm transition-all duration-200 ${section === id ? "bg-[#2A1E17] text-[#FFFDF8] shadow-[3px_3px_0_#FF5722]" : "text-[#6B5A4E] hover:translate-x-1 hover:bg-[#FFFDF8] hover:text-[#2A1E17]"}`}
            >
              <span className="flex items-center gap-3">
                <Icon size={17} strokeWidth={section === id ? 2.3 : 1.7} />
                <span data-testid={`navigation-${id}-label`}>{label}</span>
              </span>
              {count !== undefined && (
                <span
                  data-testid={`navigation-${id}-count`}
                  className={`font-mono text-[10px] ${section === id ? "text-[#FDD9C9]" : "text-[#948275]"}`}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto">
          <div
            data-testid="mock-mode-notice"
            className="rounded-sm border border-[#E5DFD5] bg-[#FFFDF8] p-3 shadow-[0_4px_20px_rgba(42,30,23,0.04)]"
          >
            <div className="flex items-start gap-2">
              <Sparkles size={15} className="mt-0.5 text-[#FF5722]" />
              <div>
                <p
                  data-testid="mock-mode-title"
                  className="font-mono text-[10px] font-bold uppercase tracking-wider"
                >
                  Demo workspace
                </p>
                <p
                  data-testid="mock-mode-description"
                  className="mt-1 text-xs leading-relaxed text-[#6B5A4E]"
                >
                  External asset links are currently{" "}
                  <strong className="text-[#FF5722]">MOCKED</strong> for this preview.
                </p>
              </div>
            </div>
          </div>
          <button
            data-testid="settings-button"
            onClick={() => toast.info("Workspace settings are coming next")}
            className="mt-5 flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm text-[#6B5A4E] hover:bg-[#FFFDF8] hover:text-[#2A1E17]"
          >
            <Settings2 size={17} />
            Settings
          </button>
        </div>
      </aside>

      <div className="lg:pl-[250px]">
        <header
          data-testid="top-header"
          className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#E5DFD5] bg-[#FAF7F2]/90 px-5 backdrop-blur-md md:px-8"
        >
          <div className="flex items-center gap-3">
            <button
              data-testid="mobile-open-navigation-button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-full border border-[#E5DFD5] p-2 lg:hidden"
            >
              <Menu size={18} />
            </button>
            <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#948275] sm:flex">
              <span data-testid="breadcrumb-workspace">Workspace</span>
              <span>/</span>
              <span data-testid="breadcrumb-section" className="text-[#2A1E17]">
                {navItems.find((item) => item.id === section)?.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              data-testid="header-search-button"
              onClick={() => navigate("content")}
              className="hidden items-center gap-2 rounded-full border border-[#E5DFD5] bg-[#FFFDF8] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-[#948275] transition hover:border-[#FF5722] sm:flex"
            >
              <Search size={14} />
              Search content <span className="ml-4 rounded bg-[#F2ECE1] px-1.5 py-0.5">⌘K</span>
            </button>
            <button
              data-testid="header-create-content-button"
              onClick={() => openCreate()}
              className="flex items-center gap-2 rounded-full bg-[#FF5722] px-3 py-2 text-xs font-bold text-white shadow-[2px_2px_0_#2A1E17] transition-transform hover:-translate-y-0.5"
            >
              <Plus size={15} /> <span className="hidden sm:inline">New content</span>
            </button>
            <div
              data-testid="user-avatar"
              className="grid size-9 place-items-center rounded-full bg-[#1E40AF] font-mono text-[11px] font-bold text-white"
            >
              AM
            </div>
          </div>
        </header>

        <main data-testid="main-content" className="p-5 md:p-8 lg:p-10">
          {section === "overview" && (
            <Overview
              dashboard={dashboard}
              contents={contents}
              onNavigate={navigate}
              onCreate={openCreate}
              onSelect={selectContent}
            />
          )}
          {section === "content" && (
            <ContentPlan
              contents={contents}
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              pillarFilter={pillarFilter}
              setPillarFilter={setPillarFilter}
              onCreate={() => openCreate()}
              onEdit={openEdit}
              onSelect={selectContent}
              onDelete={(id) => deleteMutation.mutate(id)}
              onStatus={(id, status) => statusMutation.mutate({ id, patch: { status } })}
            />
          )}
          {section === "calendar" && (
            <CalendarView
              contents={contents}
              monthCursor={monthCursor}
              setMonthCursor={setMonthCursor}
              monthDays={monthDays}
              calendarContent={calendarContent}
              onCreate={openCreate}
              onSelect={selectContent}
              onDrop={(id, date) =>
                statusMutation.mutate({ id, patch: { scheduled_date: date, status: "scheduled" } })
              }
            />
          )}
          {section === "media" && (
            <MediaLibrary
              assets={assets}
              assetOpen={assetOpen}
              setAssetOpen={setAssetOpen}
              assetForm={assetForm}
              setAssetForm={setAssetForm}
              onAdd={() => assetMutation.mutate()}
            />
          )}
          {section === "analytics" && <Analytics dashboard={dashboard} contents={contents} />}
        </main>
      </div>

      <AnimatePresence>
        {selectedContent && (
          <ContentDrawer
            content={selectedContent}
            onClose={() => setSelectedContent(null)}
            onEdit={() => {
              openEdit(selectedContent);
            }}
            onStatus={(status) =>
              statusMutation.mutate({ id: selectedContent.id, patch: { status } })
            }
            onDelete={() => deleteMutation.mutate(selectedContent.id)}
            commentText={commentText}
            setCommentText={setCommentText}
            onComment={() =>
              commentText.trim() &&
              commentMutation.mutate({ id: selectedContent.id, message: commentText.trim() })
            }
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editorOpen && (
          <EditorModal
            form={form}
            setForm={setForm}
            editingId={editingId}
            onClose={() => setEditorOpen(false)}
            onSave={() => saveMutation.mutate()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Overview({
  dashboard,
  contents,
  onNavigate,
  onCreate,
  onSelect,
}: {
  dashboard?: DashboardSummary | undefined;
  contents: Content[];
  onNavigate: (section: Section) => void;
  onCreate: (template?: Partial<ContentForm>) => void;
  onSelect: (content: Content) => void;
}) {
  const upcoming =
    dashboard?.upcoming ?? contents.filter((item) => item.scheduled_date).slice(0, 4);
  const stats = [
    {
      label: "Published",
      value: dashboard?.published ?? 0,
      detail: "this cycle",
      accent: "#15803D",
      icon: CheckCircle2,
    },
    {
      label: "Scheduled",
      value: dashboard?.scheduled ?? 0,
      detail: "up next",
      accent: "#1E40AF",
      icon: CalendarDays,
    },
    {
      label: "Needs review",
      value: dashboard?.in_review ?? 0,
      detail: "awaiting team",
      accent: "#D97706",
      icon: ClipboardList,
    },
    {
      label: "Media assets",
      value: dashboard?.media_assets ?? 0,
      detail: "linked files",
      accent: "#FF5722",
      icon: FolderOpen,
    },
  ];
  return (
    <motion.div
      data-testid="overview-section"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-[1500px] space-y-8"
    >
      <section
        data-testid="overview-intro"
        className="relative overflow-hidden border-b border-[#E5DFD5] pb-8"
      >
        <div className="absolute -right-4 -top-16 hidden rotate-[-8deg] font-serif text-[190px] leading-none text-[#F2ECE1] lg:block">
          ✳
        </div>
        <div className="relative">
          <p
            data-testid="overview-eyebrow"
            className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#FF5722]"
          >
            Friday, studio notes · 09:42
          </p>
          <h1
            data-testid="overview-heading"
            className="mt-3 max-w-3xl font-heading text-4xl font-black uppercase leading-[0.95] tracking-[-0.07em] sm:text-5xl lg:text-6xl"
          >
            Make space for
            <br />
            <span className="text-[#FF5722]">good ideas.</span>
          </h1>
          <p
            data-testid="overview-description"
            className="mt-5 max-w-lg text-sm leading-7 text-[#6B5A4E]"
          >
            A calm place to plan the next story, keep the team moving, and turn everyday work into
            something worth sharing.
          </p>
        </div>
        <div className="relative mt-7 flex flex-wrap gap-3">
          <Button
            data-testid="overview-create-button"
            onClick={() => onCreate()}
            className="h-10 rounded-full bg-[#2A1E17] px-5 text-xs font-bold text-white hover:bg-[#FF5722]"
          >
            <Plus size={15} />
            Create content
          </Button>
          <Button
            data-testid="overview-calendar-button"
            onClick={() => onNavigate("calendar")}
            variant="outline"
            className="h-10 rounded-full border-[#D8CFC1] bg-transparent px-5 text-xs font-bold text-[#2A1E17]"
          >
            <CalendarDays size={15} />
            Open calendar
          </Button>
        </div>
      </section>
      <section data-testid="summary-stats-grid" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, detail, accent, icon: Icon }) => (
          <Card
            key={label}
            data-testid={`summary-card-${label.toLowerCase().replaceAll(" ", "-")}`}
            className="rounded-sm border-[#E5DFD5] bg-[#FFFDF8] shadow-[0_4px_20px_rgba(42,30,23,0.04)]"
          >
            <CardContent className="p-4 md:p-5">
              <div className="flex items-start justify-between">
                <span
                  data-testid={`summary-label-${label.toLowerCase().replaceAll(" ", "-")}`}
                  className="font-mono text-[10px] uppercase tracking-wider text-[#948275]"
                >
                  {label}
                </span>
                <Icon
                  data-testid={`summary-icon-${label.toLowerCase().replaceAll(" ", "-")}`}
                  size={17}
                  style={{ color: accent }}
                />
              </div>
              <p
                data-testid={`summary-value-${label.toLowerCase().replaceAll(" ", "-")}`}
                className="mt-3 font-heading text-3xl font-black tracking-[-0.06em]"
              >
                {value}
              </p>
              <p
                data-testid={`summary-detail-${label.toLowerCase().replaceAll(" ", "-")}`}
                className="mt-1 text-xs text-[#948275]"
              >
                {detail}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card
          data-testid="upcoming-content-card"
          className="rounded-sm border-[#E5DFD5] bg-[#FFFDF8] shadow-[0_4px_20px_rgba(42,30,23,0.04)]"
        >
          <CardHeader className="flex flex-row items-center justify-between border-b border-[#E5DFD5] px-5 py-4">
            <div>
              <p
                data-testid="upcoming-eyebrow"
                className="font-mono text-[10px] uppercase tracking-wider text-[#FF5722]"
              >
                The near future
              </p>
              <CardTitle
                data-testid="upcoming-heading"
                className="mt-1 font-heading text-xl font-bold tracking-[-0.04em]"
              >
                Upcoming content
              </CardTitle>
            </div>
            <Button
              data-testid="view-all-content-button"
              onClick={() => onNavigate("content")}
              variant="ghost"
              size="sm"
              className="font-mono text-[10px] uppercase tracking-wider"
            >
              View all <ArrowUpRight size={14} />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {upcoming.length ? (
              upcoming.map((content) => (
                <button
                  data-testid={`upcoming-content-${content.id}`}
                  key={content.id}
                  onClick={() => onSelect(content)}
                  className="flex w-full items-center gap-4 border-b border-[#E5DFD5] p-4 text-left transition hover:bg-[#F9F3E9] last:border-0"
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-sm bg-[#F2ECE1] font-heading text-lg font-black text-[#FF5722]">
                    {new Date(`${content.scheduled_date ?? "2025-01-01"}T12:00:00`).getDate()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        data-testid={`upcoming-title-${content.id}`}
                        className="truncate text-sm font-semibold"
                      >
                        {content.title}
                      </p>
                      <StatusPill status={content.status} />
                    </div>
                    <p
                      data-testid={`upcoming-meta-${content.id}`}
                      className="mt-1 font-mono text-[10px] uppercase tracking-wide text-[#948275]"
                    >
                      {formatDate(content.scheduled_date)} · {content.scheduled_time ?? "Anytime"}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-[#948275]" />
                </button>
              ))
            ) : (
              <EmptyState
                data-testid="upcoming-empty-state"
                text="No scheduled stories yet."
                action="Plan your first"
                onClick={() => onCreate()}
              />
            )}
          </CardContent>
        </Card>
        <Card
          data-testid="starter-templates-card"
          className="rounded-sm border-[#2A1E17] bg-[#2A1E17] text-[#FFFDF8] shadow-[4px_4px_0_#FF5722]"
        >
          <CardContent className="p-5 md:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p
                  data-testid="templates-eyebrow"
                  className="font-mono text-[10px] uppercase tracking-wider text-[#F7B39B]"
                >
                  Start somewhere
                </p>
                <h2
                  data-testid="templates-heading"
                  className="mt-2 font-heading text-2xl font-black uppercase leading-none tracking-[-0.05em]"
                >
                  Starter templates
                </h2>
              </div>
              <Sparkles data-testid="templates-icon" className="text-[#FF5722]" />
            </div>
            <p
              data-testid="templates-description"
              className="mt-4 text-sm leading-6 text-[#D8CFC1]"
            >
              A few thoughtful starting points, for the days when the blank page feels too loud.
            </p>
            <div className="mt-6 space-y-2">
              {[
                { name: "Weekly education", pillar: "Edukasi", platform: "Instagram Carousel" },
                { name: "Product launch", pillar: "Promosi", platform: "IG + TikTok" },
                { name: "Founder notes", pillar: "Soft Sell", platform: "LinkedIn" },
              ].map((template) => (
                <button
                  data-testid={`template-${template.pillar.toLowerCase().replaceAll(" ", "-")}-button`}
                  key={template.name}
                  onClick={() =>
                    onCreate({
                      title: template.name,
                      pillar: template.pillar,
                      description: `A ${template.name.toLowerCase()} story for this week's plan.`,
                    })
                  }
                  className="flex w-full items-center justify-between border-b border-white/15 py-3 text-left text-sm transition hover:pl-2"
                >
                  <span>
                    <span
                      data-testid={`template-name-${template.pillar.toLowerCase().replaceAll(" ", "-")}`}
                      className="block font-semibold"
                    >
                      {template.name}
                    </span>
                    <span
                      data-testid={`template-platform-${template.pillar.toLowerCase().replaceAll(" ", "-")}`}
                      className="font-mono text-[10px] uppercase tracking-wider text-[#B9ABA0]"
                    >
                      {template.platform}
                    </span>
                  </span>
                  <Plus size={15} className="text-[#FF5722]" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </motion.div>
  );
}

function ContentPlan({
  contents,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  pillarFilter,
  setPillarFilter,
  onCreate,
  onEdit,
  onSelect,
  onDelete,
  onStatus,
}: {
  contents: Content[];
  search: string;
  setSearch: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  pillarFilter: string;
  setPillarFilter: (value: string) => void;
  onCreate: () => void;
  onEdit: (content: Content) => void;
  onSelect: (content: Content) => void;
  onDelete: (id: string) => void;
  onStatus: (id: string, status: ContentStatus) => void;
}) {
  return (
    <motion.div
      data-testid="content-plan-section"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-[1500px] space-y-6"
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p
            data-testid="content-eyebrow"
            className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#FF5722]"
          >
            The working table
          </p>
          <h1
            data-testid="content-heading"
            className="mt-2 font-heading text-4xl font-black uppercase tracking-[-0.07em]"
          >
            Content plan<span className="text-[#FF5722]">.</span>
          </h1>
          <p data-testid="content-description" className="mt-2 text-sm text-[#6B5A4E]">
            Every idea has a place to land, move, and become real.
          </p>
        </div>
        <Button
          data-testid="content-create-button"
          onClick={onCreate}
          className="rounded-full bg-[#FF5722] font-bold text-white hover:bg-[#E64A19]"
        >
          <Plus size={16} />
          New content
        </Button>
      </div>
      <div
        data-testid="content-filter-bar"
        className="flex flex-col gap-2 rounded-sm border border-[#E5DFD5] bg-[#FFFDF8] p-3 md:flex-row"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-[#948275]" size={16} />
          <Input
            data-testid="content-search-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search titles, captions, ideas..."
            className="h-9 border-0 bg-[#F7F1E7] pl-9 text-sm focus-visible:ring-1 focus-visible:ring-[#FF5722]"
          />
        </div>
        <select
          data-testid="status-filter-select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-9 rounded-lg border border-[#E5DFD5] bg-[#F7F1E7] px-3 font-mono text-[10px] uppercase tracking-wider outline-none focus:border-[#FF5722]"
        >
          <option value="all">All statuses</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          data-testid="pillar-filter-select"
          value={pillarFilter}
          onChange={(event) => setPillarFilter(event.target.value)}
          className="h-9 rounded-lg border border-[#E5DFD5] bg-[#F7F1E7] px-3 font-mono text-[10px] uppercase tracking-wider outline-none focus:border-[#FF5722]"
        >
          <option value="all">All pillars</option>
          {pillars.map((pillar) => (
            <option key={pillar} value={pillar}>
              {pillar}
            </option>
          ))}
        </select>
        <Button
          data-testid="clear-filters-button"
          onClick={() => {
            setSearch("");
            setStatusFilter("all");
            setPillarFilter("all");
          }}
          variant="ghost"
          size="icon"
          className="h-9 w-9"
        >
          <Filter size={16} />
        </Button>
      </div>
      <Card
        data-testid="content-table-card"
        className="overflow-hidden rounded-sm border-[#E5DFD5] bg-[#FFFDF8] shadow-[0_4px_20px_rgba(42,30,23,0.04)]"
      >
        <div className="hidden grid-cols-[1.8fr_1fr_1.2fr_1fr_80px] gap-4 border-b border-[#E5DFD5] bg-[#F7F1E7] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#948275] md:grid">
          <span data-testid="table-header-content">Content</span>
          <span data-testid="table-header-pillar">Pillar</span>
          <span data-testid="table-header-platform">Platform</span>
          <span data-testid="table-header-status">Status</span>
          <span data-testid="table-header-actions">Action</span>
        </div>
        {contents.length ? (
          contents.map((content) => (
            <div
              data-testid={`content-row-${content.id}`}
              key={content.id}
              className="grid gap-3 border-b border-[#E5DFD5] px-4 py-4 transition hover:bg-[#FBF5EB] md:grid-cols-[1.8fr_1fr_1.2fr_1fr_80px] md:items-center md:gap-4 md:px-5"
            >
              <button
                data-testid={`content-select-${content.id}`}
                onClick={() => onSelect(content)}
                className="min-w-0 text-left"
              >
                <p
                  data-testid={`content-row-title-${content.id}`}
                  className="truncate text-sm font-semibold"
                >
                  {content.title}
                </p>
                <p
                  data-testid={`content-row-date-${content.id}`}
                  className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[#948275]"
                >
                  {formatDate(content.scheduled_date)}{" "}
                  {content.scheduled_time && `· ${content.scheduled_time}`}
                </p>
              </button>
              <div data-testid={`content-row-pillar-${content.id}`}>
                <span className="inline-flex rounded-full bg-[#F2ECE1] px-2.5 py-1 text-xs text-[#6B5A4E]">
                  {content.pillar}
                </span>
              </div>
              <div
                data-testid={`content-row-platforms-${content.id}`}
                className="flex flex-wrap gap-1"
              >
                {content.platforms.slice(0, 2).map((platform) => (
                  <PlatformChip key={platform} platform={platform} />
                ))}
              </div>
              <button
                data-testid={`content-status-${content.id}`}
                onClick={() =>
                  onStatus(content.id, content.status === "published" ? "idea" : "published")
                }
                className="w-fit"
              >
                <StatusPill status={content.status} />
              </button>
              <div className="flex items-center gap-1 md:justify-end">
                <button
                  data-testid={`content-edit-${content.id}`}
                  onClick={() => onEdit(content)}
                  className="rounded p-2 text-[#6B5A4E] hover:bg-[#F2ECE1] hover:text-[#FF5722]"
                >
                  <PenLine size={15} />
                </button>
                <button
                  data-testid={`content-delete-${content.id}`}
                  onClick={() => onDelete(content.id)}
                  className="rounded p-2 text-[#6B5A4E] hover:bg-[#FCE7E2] hover:text-[#C73A22]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            data-testid="content-empty-state"
            text="No content matches these filters."
            action="Create new content"
            onClick={onCreate}
          />
        )}
      </Card>
    </motion.div>
  );
}

function CalendarView({
  contents,
  monthCursor,
  setMonthCursor,
  monthDays,
  calendarContent,
  onCreate,
  onSelect,
  onDrop,
}: {
  contents: Content[];
  monthCursor: Date;
  setMonthCursor: (date: Date) => void;
  monthDays: (Date | null)[];
  calendarContent: (date: Date) => Content[];
  onCreate: (template?: Partial<ContentForm>) => void;
  onSelect: (content: Content) => void;
  onDrop: (id: string, date: string) => void;
}) {
  return (
    <motion.div
      data-testid="calendar-section"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-[1500px] space-y-6"
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p
            data-testid="calendar-eyebrow"
            className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#FF5722]"
          >
            The rhythm of work
          </p>
          <h1
            data-testid="calendar-heading"
            className="mt-2 font-heading text-4xl font-black uppercase tracking-[-0.07em]"
          >
            Editorial calendar<span className="text-[#FF5722]">.</span>
          </h1>
          <p data-testid="calendar-description" className="mt-2 text-sm text-[#6B5A4E]">
            Drag a story to a new day. Good timing is part of the craft.
          </p>
        </div>
        <Button
          data-testid="calendar-create-button"
          onClick={() => onCreate()}
          className="rounded-full bg-[#2A1E17] font-bold text-white hover:bg-[#FF5722]"
        >
          <Plus size={16} />
          Schedule content
        </Button>
      </div>
      <Card
        data-testid="calendar-card"
        className="overflow-hidden rounded-sm border-[#E5DFD5] bg-[#FFFDF8] shadow-[0_4px_20px_rgba(42,30,23,0.04)]"
      >
        <div className="flex items-center justify-between border-b border-[#E5DFD5] px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              data-testid="calendar-previous-month-button"
              onClick={() =>
                setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))
              }
              className="rounded-full border border-[#E5DFD5] p-2 hover:border-[#FF5722]"
            >
              <ChevronLeft size={16} />
            </button>
            <h2
              data-testid="calendar-month-label"
              className="min-w-36 text-center font-heading text-xl font-bold tracking-[-0.04em]"
            >
              {monthCursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </h2>
            <button
              data-testid="calendar-next-month-button"
              onClick={() =>
                setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))
              }
              className="rounded-full border border-[#E5DFD5] p-2 hover:border-[#FF5722]"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span
              data-testid="calendar-drag-hint"
              className="font-mono text-[10px] uppercase tracking-wider text-[#948275]"
            >
              Drag & drop enabled
            </span>
            <Grid2X2 size={15} className="text-[#FF5722]" />
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-[#E5DFD5] bg-[#F7F1E7]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div
              data-testid={`calendar-weekday-${day.toLowerCase()}`}
              key={day}
              className="p-2 text-center font-mono text-[9px] uppercase tracking-wider text-[#948275] md:p-3"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {monthDays.map((date, index) => (
            <div
              data-testid={
                date ? `calendar-day-${date.toISOString().slice(0, 10)}` : `calendar-blank-${index}`
              }
              key={date?.toISOString() ?? `blank-${index}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const id = event.dataTransfer.getData("content-id");
                if (id && date) onDrop(id, date.toISOString().slice(0, 10));
              }}
              className={`min-h-28 border-b border-r border-[#E5DFD5] p-1.5 transition-colors md:min-h-36 md:p-2 ${date ? "hover:bg-[#FFF8EF]" : "bg-[#FBF8F3]"}`}
            >
              {date && (
                <>
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      data-testid={`calendar-date-number-${date.toISOString().slice(0, 10)}`}
                      className={`font-mono text-[10px] ${date.toDateString() === new Date().toDateString() ? "grid size-6 place-items-center rounded-full bg-[#FF5722] font-bold text-white" : "text-[#948275]"}`}
                    >
                      {date.getDate()}
                    </span>
                    {calendarContent(date).length > 0 && (
                      <span
                        data-testid={`calendar-day-count-${date.toISOString().slice(0, 10)}`}
                        className="font-mono text-[9px] text-[#948275]"
                      >
                        {calendarContent(date).length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {calendarContent(date).map((content) => (
                      <button
                        data-testid={`calendar-content-${content.id}`}
                        draggable
                        onDragStart={(event) =>
                          event.dataTransfer.setData("content-id", content.id)
                        }
                        onClick={() => onSelect(content)}
                        key={content.id}
                        className="w-full rounded-sm border border-[#E5DFD5] bg-[#FFFDF8] p-1.5 text-left shadow-[0_2px_6px_rgba(42,30,23,0.04)] transition hover:-translate-y-0.5"
                      >
                        <span className="block truncate text-[10px] font-semibold leading-tight">
                          {content.title}
                        </span>
                        <span className="mt-1 block truncate font-mono text-[8px] uppercase tracking-wide text-[#FF5722]">
                          {content.pillar}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

function MediaLibrary({
  assets,
  assetOpen,
  setAssetOpen,
  assetForm,
  setAssetForm,
  onAdd,
}: {
  assets: Asset[];
  assetOpen: boolean;
  setAssetOpen: (open: boolean) => void;
  assetForm: { title: string; url: string; provider: AssetProvider; kind: string; notes: string };
  setAssetForm: (value: {
    title: string;
    url: string;
    provider: AssetProvider;
    kind: string;
    notes: string;
  }) => void;
  onAdd: () => void;
}) {
  const [filter, setFilter] = useState("");
  const filtered = assets.filter(
    (asset) =>
      asset.title.toLowerCase().includes(filter.toLowerCase()) ||
      providerLabels[asset.provider].toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <motion.div
      data-testid="media-section"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-[1500px] space-y-6"
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p
            data-testid="media-eyebrow"
            className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#FF5722]"
          >
            The visual shelf
          </p>
          <h1
            data-testid="media-heading"
            className="mt-2 font-heading text-4xl font-black uppercase tracking-[-0.07em]"
          >
            Media library<span className="text-[#FF5722]">.</span>
          </h1>
          <p data-testid="media-description" className="mt-2 text-sm text-[#6B5A4E]">
            Keep links to the work close, wherever the files live.
          </p>
        </div>
        <Button
          data-testid="media-add-button"
          onClick={() => setAssetOpen(true)}
          className="rounded-full bg-[#FF5722] font-bold text-white hover:bg-[#E64A19]"
        >
          <Plus size={16} />
          Add asset link
        </Button>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 text-[#948275]" size={16} />
        <Input
          data-testid="media-search-input"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search your visual shelf..."
          className="h-10 border-[#E5DFD5] bg-[#FFFDF8] pl-9"
        />
      </div>
      {assetOpen && (
        <AssetForm
          assetForm={assetForm}
          setAssetForm={setAssetForm}
          onClose={() => setAssetOpen(false)}
          onAdd={onAdd}
        />
      )}
      {filtered.length ? (
        <div data-testid="media-grid" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {filtered.map((asset) => (
            <Card
              data-testid={`asset-card-${asset.id}`}
              key={asset.id}
              className="group overflow-hidden rounded-sm border-[#E5DFD5] bg-[#FFFDF8] shadow-[0_4px_20px_rgba(42,30,23,0.04)]"
            >
              <div className="relative h-36 overflow-hidden bg-[#F2ECE1]">
                <img
                  data-testid={`asset-image-${asset.id}`}
                  src={
                    asset.provider === "canva"
                      ? "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=800&q=80"
                      : asset.provider === "figma"
                        ? "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=800&q=80"
                        : "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80"
                  }
                  alt={asset.title}
                  className="h-full w-full object-cover grayscale-[20%] transition duration-500 group-hover:scale-105"
                />
                <span
                  data-testid={`asset-mocked-badge-${asset.id}`}
                  className="absolute left-3 top-3 rounded-full bg-[#FFFDF8]/90 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-[#FF5722]"
                >
                  {asset.status}
                </span>
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p data-testid={`asset-title-${asset.id}`} className="font-semibold">
                      {asset.title}
                    </p>
                    <p
                      data-testid={`asset-kind-${asset.id}`}
                      className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[#948275]"
                    >
                      {asset.kind}
                    </p>
                  </div>
                  <span
                    data-testid={`asset-provider-${asset.id}`}
                    className={`rounded-full px-2 py-1 font-mono text-[9px] font-bold uppercase ${providerColors[asset.provider]}`}
                  >
                    {providerLabels[asset.provider]}
                  </span>
                </div>
                <p
                  data-testid={`asset-notes-${asset.id}`}
                  className="mt-3 line-clamp-2 text-xs leading-5 text-[#6B5A4E]"
                >
                  {asset.notes || "No notes yet."}
                </p>
                <div className="mt-4 flex items-center gap-2 border-t border-[#E5DFD5] pt-3">
                  <a
                    data-testid={`asset-open-${asset.id}`}
                    href={asset.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#1E40AF] hover:text-[#FF5722]"
                  >
                    Open source <ExternalLink size={12} />
                  </a>
                  <button
                    data-testid={`asset-copy-${asset.id}`}
                    onClick={() => {
                      void navigator.clipboard?.writeText(asset.url);
                      toast.success("Asset link copied");
                    }}
                    className="rounded p-1.5 text-[#948275] hover:bg-[#F2ECE1] hover:text-[#2A1E17]"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          data-testid="media-empty-state"
          text="Your visual shelf is waiting."
          action="Add the first link"
          onClick={() => setAssetOpen(true)}
        />
      )}
    </motion.div>
  );
}

function AssetForm({
  assetForm,
  setAssetForm,
  onClose,
  onAdd,
}: {
  assetForm: { title: string; url: string; provider: AssetProvider; kind: string; notes: string };
  setAssetForm: (value: {
    title: string;
    url: string;
    provider: AssetProvider;
    kind: string;
    notes: string;
  }) => void;
  onClose: () => void;
  onAdd: () => void;
}) {
  return (
    <motion.div
      data-testid="asset-form"
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-sm border border-[#FFCCB8] bg-[#FFF7F2] p-4 md:p-5"
    >
      <div className="flex items-center justify-between">
        <div>
          <p
            data-testid="asset-form-eyebrow"
            className="font-mono text-[10px] uppercase tracking-wider text-[#FF5722]"
          >
            New external link
          </p>
          <h2 data-testid="asset-form-heading" className="mt-1 font-heading text-xl font-bold">
            Add to the shelf
          </h2>
        </div>
        <button
          data-testid="asset-form-close-button"
          onClick={onClose}
          className="rounded-full p-2 hover:bg-white"
        >
          <X size={16} />
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Input
          data-testid="asset-title-input"
          value={assetForm.title}
          onChange={(event) => setAssetForm({ ...assetForm, title: event.target.value })}
          placeholder="Asset title"
        />
        <Input
          data-testid="asset-url-input"
          type="url"
          value={assetForm.url}
          onChange={(event) => setAssetForm({ ...assetForm, url: event.target.value })}
          placeholder="https://..."
        />
        <select
          data-testid="asset-provider-select"
          value={assetForm.provider}
          onChange={(event) =>
            setAssetForm({ ...assetForm, provider: event.target.value as AssetProvider })
          }
          className="h-9 rounded-lg border border-[#E5DFD5] bg-white px-3 text-sm"
        >
          <option value="google_drive">Google Drive</option>
          <option value="dropbox">Dropbox</option>
          <option value="canva">Canva</option>
          <option value="figma">Figma</option>
        </select>
        <Input
          data-testid="asset-kind-input"
          value={assetForm.kind}
          onChange={(event) => setAssetForm({ ...assetForm, kind: event.target.value })}
          placeholder="Asset type"
        />
        <Textarea
          data-testid="asset-notes-input"
          value={assetForm.notes}
          onChange={(event) => setAssetForm({ ...assetForm, notes: event.target.value })}
          placeholder="Notes for the team"
          className="min-h-20 bg-white md:col-span-2"
        />
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <span
          data-testid="asset-mock-form-note"
          className="mr-auto font-mono text-[10px] uppercase tracking-wider text-[#948275]"
        >
          Provider sync is MOCKED
        </span>
        <Button data-testid="asset-cancel-button" onClick={onClose} variant="ghost">
          Cancel
        </Button>
        <Button
          data-testid="asset-save-button"
          onClick={onAdd}
          className="bg-[#FF5722] font-bold text-white hover:bg-[#E64A19]"
        >
          Save link
        </Button>
      </div>
    </motion.div>
  );
}

function Analytics({
  dashboard,
  contents,
}: {
  dashboard?: DashboardSummary | undefined;
  contents: Content[];
}) {
  const published = contents.filter((content) => content.status === "published");
  const totalViews = published.reduce((sum, item) => sum + item.metrics.views, 0);
  const totalLikes = published.reduce((sum, item) => sum + item.metrics.likes, 0);
  const max = Math.max(...(dashboard?.content_by_status.map((item) => item.count) ?? [1]), 1);
  return (
    <motion.div
      data-testid="analytics-section"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-[1500px] space-y-6"
    >
      <div>
        <p
          data-testid="analytics-eyebrow"
          className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#FF5722]"
        >
          The quiet numbers
        </p>
        <h1
          data-testid="analytics-heading"
          className="mt-2 font-heading text-4xl font-black uppercase tracking-[-0.07em]"
        >
          Content pulse<span className="text-[#FF5722]">.</span>
        </h1>
        <p data-testid="analytics-description" className="mt-2 text-sm text-[#6B5A4E]">
          A simple read on what is moving, resonating, and waiting for a little care.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <AnalyticsMetric
          data-testid="analytics-views-metric"
          label="Tracked views"
          value={totalViews.toLocaleString()}
          detail="from published posts"
        />
        <AnalyticsMetric
          data-testid="analytics-likes-metric"
          label="Reactions"
          value={totalLikes.toLocaleString()}
          detail="likes on published posts"
        />
        <AnalyticsMetric
          data-testid="analytics-pillar-metric"
          label="Top pillar"
          value={published[0]?.pillar ?? "—"}
          detail="based on your current log"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Card
          data-testid="workflow-breakdown-card"
          className="rounded-sm border-[#E5DFD5] bg-[#FFFDF8]"
        >
          <CardHeader>
            <p
              data-testid="workflow-eyebrow"
              className="font-mono text-[10px] uppercase tracking-wider text-[#FF5722]"
            >
              Workflow health
            </p>
            <CardTitle data-testid="workflow-heading" className="font-heading text-xl">
              Where ideas are today
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(dashboard?.content_by_status ?? []).map((item) => (
              <div data-testid={`analytics-status-row-${item.status}`} key={item.status}>
                <div className="mb-1 flex justify-between text-sm">
                  <span data-testid={`analytics-status-label-${item.status}`}>
                    {statusLabels[item.status as ContentStatus] ?? item.status}
                  </span>
                  <span
                    data-testid={`analytics-status-count-${item.status}`}
                    className="font-mono text-xs text-[#948275]"
                  >
                    {item.count}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#F2ECE1]">
                  <div
                    data-testid={`analytics-status-bar-${item.status}`}
                    className="h-full rounded-full bg-[#FF5722] transition-all"
                    style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card
          data-testid="performance-log-card"
          className="rounded-sm border-[#E5DFD5] bg-[#2A1E17] text-[#FFFDF8]"
        >
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <p
                data-testid="performance-eyebrow"
                className="font-mono text-[10px] uppercase tracking-wider text-[#F7B39B]"
              >
                Post performance log
              </p>
              <CardTitle data-testid="performance-heading" className="font-heading text-xl">
                What landed
              </CardTitle>
            </div>
            <BarChart3 className="text-[#FF5722]" />
          </CardHeader>
          <CardContent>
            {published.length ? (
              published.map((content) => (
                <div
                  data-testid={`performance-row-${content.id}`}
                  key={content.id}
                  className="flex items-center justify-between border-t border-white/15 py-3"
                >
                  <div className="min-w-0">
                    <p
                      data-testid={`performance-title-${content.id}`}
                      className="truncate text-sm font-semibold"
                    >
                      {content.title}
                    </p>
                    <p
                      data-testid={`performance-platform-${content.id}`}
                      className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[#B9ABA0]"
                    >
                      {content.platforms[0]}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      data-testid={`performance-views-${content.id}`}
                      className="font-heading text-lg font-bold"
                    >
                      {content.metrics.views.toLocaleString()}
                    </p>
                    <p
                      data-testid={`performance-engagement-${content.id}`}
                      className="font-mono text-[9px] uppercase tracking-wider text-[#F7B39B]"
                    >
                      {content.metrics.engagement_rate}% engaged
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p data-testid="performance-empty-state" className="py-8 text-sm text-[#D8CFC1]">
                Publish a story to start tracking its pulse.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <div
        data-testid="analytics-export-panel"
        className="flex flex-col justify-between gap-3 rounded-sm border border-[#FFCCB8] bg-[#FFF0E8] p-5 md:flex-row md:items-center"
      >
        <div>
          <p data-testid="export-panel-title" className="font-heading text-lg font-bold">
            Take the plan with you
          </p>
          <p data-testid="export-panel-description" className="mt-1 text-sm text-[#6B5A4E]">
            Download a clean spreadsheet for your next team check-in.
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton format="csv" />
          <ExportButton format="xlsx" />
        </div>
      </div>
    </motion.div>
  );
}

function AnalyticsMetric({
  label,
  value,
  detail,
  ...props
}: {
  label: string;
  value: string;
  detail: string;
  "data-testid": string;
}) {
  return (
    <Card {...props} className="rounded-sm border-[#E5DFD5] bg-[#FFFDF8]">
      <CardContent className="p-5">
        <p
          data-testid={`${props["data-testid"]}-label`}
          className="font-mono text-[10px] uppercase tracking-wider text-[#948275]"
        >
          {label}
        </p>
        <p
          data-testid={`${props["data-testid"]}-value`}
          className="mt-3 font-heading text-3xl font-black tracking-[-0.06em]"
        >
          {value}
        </p>
        <p data-testid={`${props["data-testid"]}-detail`} className="mt-1 text-xs text-[#948275]">
          {detail}
        </p>
      </CardContent>
    </Card>
  );
}

function ExportButton({ format }: { format: "csv" | "xlsx" }) {
  return (
    <Button
      data-testid={`export-${format}-button`}
      onClick={() =>
        apiDownload(`/exports/content-plan?format=${format}`, `content-plan.${format}`)
          .then(() => toast.success(`${format.toUpperCase()} downloaded`))
          .catch(() => toast.error("Export is not available yet"))
      }
      variant="outline"
      className="border-[#D8CFC1] bg-[#FFFDF8] font-mono text-[10px] font-bold uppercase tracking-wider"
    >
      <Download size={14} />
      {format}
    </Button>
  );
}

function ContentDrawer({
  content,
  onClose,
  onEdit,
  onStatus,
  onDelete,
  commentText,
  setCommentText,
  onComment,
}: {
  content: Content;
  onClose: () => void;
  onEdit: () => void;
  onStatus: (status: ContentStatus) => void;
  onDelete: () => void;
  commentText: string;
  setCommentText: (value: string) => void;
  onComment: () => void;
}) {
  return (
    <motion.div
      data-testid="content-detail-drawer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#2A1E17]/25 backdrop-blur-sm"
    >
      <motion.aside
        data-testid="content-detail-panel"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 240 }}
        className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-[#E5DFD5] bg-[#FFFDF8] shadow-[-10px_0_40px_rgba(42,30,23,0.14)]"
      >
        <div className="flex items-center justify-between border-b border-[#E5DFD5] p-5">
          <div>
            <p
              data-testid="drawer-eyebrow"
              className="font-mono text-[10px] uppercase tracking-wider text-[#FF5722]"
            >
              Content detail
            </p>
            <p data-testid="drawer-content-id" className="mt-1 font-mono text-[9px] text-[#948275]">
              {content.id.slice(0, 8)} / live record
            </p>
          </div>
          <button
            data-testid="drawer-close-button"
            onClick={onClose}
            className="rounded-full border border-[#E5DFD5] p-2 hover:border-[#FF5722]"
          >
            <X size={17} />
          </button>
        </div>
        <div className="space-y-6 p-5 md:p-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={content.status} />
              <span
                data-testid="drawer-pillar"
                className="rounded-full bg-[#F2ECE1] px-2.5 py-1 text-xs text-[#6B5A4E]"
              >
                {content.pillar}
              </span>
            </div>
            <h2
              data-testid="drawer-title"
              className="mt-4 font-heading text-3xl font-black leading-none tracking-[-0.06em]"
            >
              {content.title}
            </h2>
            <p data-testid="drawer-description" className="mt-3 text-sm leading-6 text-[#6B5A4E]">
              {content.description || "No description yet."}
            </p>
          </div>
          <div data-testid="drawer-schedule-block" className="grid grid-cols-2 gap-3">
            <div className="rounded-sm bg-[#F7F1E7] p-3">
              <p
                data-testid="drawer-date-label"
                className="font-mono text-[9px] uppercase tracking-wider text-[#948275]"
              >
                Publish date
              </p>
              <p data-testid="drawer-date-value" className="mt-2 text-sm font-semibold">
                {formatDate(content.scheduled_date)}
              </p>
            </div>
            <div className="rounded-sm bg-[#F7F1E7] p-3">
              <p
                data-testid="drawer-time-label"
                className="font-mono text-[9px] uppercase tracking-wider text-[#948275]"
              >
                Time
              </p>
              <p data-testid="drawer-time-value" className="mt-2 text-sm font-semibold">
                {content.scheduled_time ?? "Anytime"}
              </p>
            </div>
          </div>
          <div data-testid="drawer-platform-list">
            <p
              data-testid="drawer-platform-label"
              className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[#948275]"
            >
              Platforms
            </p>
            <div className="flex flex-wrap gap-2">
              {content.platforms.map((platform) => (
                <PlatformChip key={platform} platform={platform} />
              ))}
            </div>
          </div>
          <div data-testid="drawer-caption-block">
            <p
              data-testid="drawer-caption-label"
              className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[#948275]"
            >
              Caption draft
            </p>
            <div
              data-testid="drawer-caption-text"
              className="rounded-sm border border-[#E5DFD5] bg-[#FDF9F3] p-4 text-sm leading-6 text-[#6B5A4E]"
            >
              {content.caption || "No caption draft yet."}
              <p data-testid="drawer-hashtags" className="mt-3 text-[#FF5722]">
                {content.hashtags}
              </p>
              <p data-testid="drawer-cta" className="mt-2 font-semibold text-[#2A1E17]">
                {content.cta}
              </p>
            </div>
          </div>
          <div data-testid="drawer-action-row" className="flex flex-wrap gap-2">
            <Button
              data-testid="drawer-edit-button"
              onClick={onEdit}
              className="bg-[#2A1E17] text-white hover:bg-[#FF5722]"
            >
              <PenLine size={15} />
              Edit content
            </Button>
            <Button
              data-testid="drawer-approve-button"
              onClick={() => onStatus(content.status === "published" ? "idea" : "published")}
              variant="outline"
              className="border-[#D8CFC1]"
            >
              {content.status === "published" ? "Move to idea" : "Mark published"}
            </Button>
            <button
              data-testid="drawer-delete-button"
              onClick={onDelete}
              className="rounded-lg border border-[#F1C1B5] px-3 text-[#C73A22] hover:bg-[#FCE7E2]"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div data-testid="drawer-comments-section" className="border-t border-[#E5DFD5] pt-5">
            <div className="flex items-center justify-between">
              <p data-testid="drawer-comments-heading" className="font-heading text-lg font-bold">
                Team notes{" "}
                <span
                  data-testid="drawer-comments-count"
                  className="font-mono text-xs font-normal text-[#948275]"
                >
                  ({content.comments.length})
                </span>
              </p>
              <MessageCircle size={17} className="text-[#FF5722]" />
            </div>
            <div className="mt-4 space-y-3">
              {content.comments.map((comment) => (
                <div
                  data-testid={`drawer-comment-${comment.id}`}
                  key={comment.id}
                  className="rounded-sm bg-[#F7F1E7] p-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      data-testid={`drawer-comment-avatar-${comment.id}`}
                      className="grid size-6 place-items-center rounded-full bg-[#1E40AF] font-mono text-[9px] font-bold text-white"
                    >
                      {initials(comment.author)}
                    </span>
                    <span
                      data-testid={`drawer-comment-author-${comment.id}`}
                      className="text-xs font-semibold"
                    >
                      {comment.author}
                    </span>
                  </div>
                  <p
                    data-testid={`drawer-comment-message-${comment.id}`}
                    className="mt-2 text-sm leading-5 text-[#6B5A4E]"
                  >
                    {comment.message}
                  </p>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  data-testid="drawer-comment-input"
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onComment();
                  }}
                  placeholder="Leave a note for the team..."
                  className="bg-white"
                />
                <Button
                  data-testid="drawer-comment-submit-button"
                  onClick={onComment}
                  size="icon"
                  className="bg-[#FF5722] text-white hover:bg-[#E64A19]"
                >
                  <Send size={15} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.aside>
    </motion.div>
  );
}

function EditorModal({
  form,
  setForm,
  editingId,
  onClose,
  onSave,
}: {
  form: ContentForm;
  setForm: (value: ContentForm) => void;
  editingId: string | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const setField = <K extends keyof ContentForm>(field: K, value: ContentForm[K]) =>
    setForm({ ...form, [field]: value });
  const togglePlatform = (platform: string) =>
    setField(
      "platforms",
      form.platforms.includes(platform)
        ? form.platforms.filter((item) => item !== platform)
        : [...form.platforms, platform],
    );
  return (
    <motion.div
      data-testid="content-editor-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-[#2A1E17]/30 p-3 backdrop-blur-sm md:p-8"
    >
      <motion.div
        data-testid="content-editor-panel"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-5xl overflow-hidden rounded-sm border border-[#E5DFD5] bg-[#FFFDF8] shadow-[0_18px_60px_rgba(42,30,23,0.2)]"
      >
        <div className="flex items-center justify-between border-b border-[#E5DFD5] bg-[#F7F1E7] px-5 py-4 md:px-7">
          <div>
            <p
              data-testid="editor-eyebrow"
              className="font-mono text-[10px] uppercase tracking-wider text-[#FF5722]"
            >
              {editingId ? "Refine the story" : "A new story begins"}
            </p>
            <h2
              data-testid="editor-heading"
              className="mt-1 font-heading text-2xl font-black tracking-[-0.05em]"
            >
              {editingId ? "Edit content" : "Create content"}
            </h2>
          </div>
          <button
            data-testid="editor-close-button"
            onClick={onClose}
            className="rounded-full border border-[#D8CFC1] p-2 hover:bg-white"
          >
            <X size={17} />
          </button>
        </div>
        <div className="grid gap-8 p-5 md:p-7 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-5">
            <div>
              <label
                data-testid="content-title-label"
                htmlFor="content-title"
                className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-wider text-[#6B5A4E]"
              >
                Working title
              </label>
              <Input
                data-testid="content-title-input"
                id="content-title"
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                placeholder="Give the idea a good name"
                className="h-12 border-[#D8CFC1] bg-[#FDF9F3] font-heading text-lg font-bold focus-visible:ring-[#FF5722]"
              />
            </div>
            <div>
              <label
                data-testid="content-description-label"
                htmlFor="content-description"
                className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-wider text-[#6B5A4E]"
              >
                The thought behind it
              </label>
              <Textarea
                data-testid="content-description-input"
                id="content-description"
                value={form.description}
                onChange={(event) => setField("description", event.target.value)}
                placeholder="What is this story trying to say?"
                className="min-h-24 border-[#D8CFC1] bg-[#FDF9F3] focus-visible:ring-[#FF5722]"
              />
            </div>
            <div>
              <label
                data-testid="content-caption-label"
                htmlFor="content-caption"
                className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-wider text-[#6B5A4E]"
              >
                Caption draft
              </label>
              <Textarea
                data-testid="content-caption-input"
                id="content-caption"
                value={form.caption}
                onChange={(event) => setField("caption", event.target.value)}
                placeholder="Write like you talk to a good neighbour..."
                className="min-h-32 border-[#D8CFC1] bg-[#FDF9F3] focus-visible:ring-[#FF5722]"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label
                  data-testid="content-hashtags-label"
                  htmlFor="content-hashtags"
                  className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-wider text-[#6B5A4E]"
                >
                  Hashtag group
                </label>
                <Input
                  data-testid="content-hashtags-input"
                  id="content-hashtags"
                  value={form.hashtags}
                  onChange={(event) => setField("hashtags", event.target.value)}
                  placeholder="#behindthescenes #union"
                  className="border-[#D8CFC1] bg-[#FDF9F3]"
                />
              </div>
              <div>
                <label
                  data-testid="content-cta-label"
                  htmlFor="content-cta"
                  className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-wider text-[#6B5A4E]"
                >
                  Call to action
                </label>
                <Input
                  data-testid="content-cta-input"
                  id="content-cta"
                  value={form.cta}
                  onChange={(event) => setField("cta", event.target.value)}
                  placeholder="Visit us this weekend"
                  className="border-[#D8CFC1] bg-[#FDF9F3]"
                />
              </div>
            </div>
          </div>
          <div className="space-y-5">
            <div>
              <label
                data-testid="content-pillar-label"
                htmlFor="content-pillar"
                className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-wider text-[#6B5A4E]"
              >
                Content pillar
              </label>
              <select
                data-testid="content-pillar-select"
                id="content-pillar"
                value={form.pillar}
                onChange={(event) => setField("pillar", event.target.value)}
                className="h-10 w-full rounded-lg border border-[#D8CFC1] bg-[#FDF9F3] px-3 text-sm focus:border-[#FF5722] outline-none"
              >
                {pillars.map((pillar) => (
                  <option key={pillar}>{pillar}</option>
                ))}
              </select>
            </div>
            <div>
              <label
                data-testid="content-status-label"
                htmlFor="content-status"
                className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-wider text-[#6B5A4E]"
              >
                Workflow status
              </label>
              <select
                data-testid="content-status-select"
                id="content-status"
                value={form.status}
                onChange={(event) => setField("status", event.target.value as ContentStatus)}
                className="h-10 w-full rounded-lg border border-[#D8CFC1] bg-[#FDF9F3] px-3 text-sm focus:border-[#FF5722] outline-none"
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                data-testid="content-platform-label"
                className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-wider text-[#6B5A4E]"
              >
                Publish on
              </label>
              <div data-testid="content-platform-selector" className="flex flex-wrap gap-2">
                {platforms.map((platform) => (
                  <button
                    data-testid={`content-platform-option-${platform.toLowerCase().replaceAll(" ", "-")}`}
                    type="button"
                    key={platform}
                    onClick={() => togglePlatform(platform)}
                    className={`rounded-full border px-2.5 py-1.5 text-[10px] transition ${form.platforms.includes(platform) ? "border-[#FF5722] bg-[#FFF0E8] font-bold text-[#C73A22]" : "border-[#E5DFD5] text-[#6B5A4E] hover:border-[#FF5722]"}`}
                  >
                    {form.platforms.includes(platform) && (
                      <Check size={11} className="mr-1 inline" />
                    )}
                    {platform}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  data-testid="content-date-label"
                  htmlFor="content-date"
                  className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-wider text-[#6B5A4E]"
                >
                  Publish date
                </label>
                <Input
                  data-testid="content-date-input"
                  id="content-date"
                  type="date"
                  value={form.scheduled_date ?? ""}
                  onChange={(event) => setField("scheduled_date", event.target.value || null)}
                  className="border-[#D8CFC1] bg-[#FDF9F3]"
                />
              </div>
              <div>
                <label
                  data-testid="content-time-label"
                  htmlFor="content-time"
                  className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-wider text-[#6B5A4E]"
                >
                  Time
                </label>
                <Input
                  data-testid="content-time-input"
                  id="content-time"
                  type="time"
                  value={form.scheduled_time ?? ""}
                  onChange={(event) => setField("scheduled_time", event.target.value || null)}
                  className="border-[#D8CFC1] bg-[#FDF9F3]"
                />
              </div>
            </div>
            <div>
              <label
                data-testid="content-asset-url-label"
                htmlFor="content-asset-url"
                className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-wider text-[#6B5A4E]"
              >
                Asset link{" "}
                <span className="font-normal normal-case text-[#948275]">(optional)</span>
              </label>
              <Input
                data-testid="content-asset-url-input"
                id="content-asset-url"
                type="url"
                value={form.asset_url}
                onChange={(event) => setField("asset_url", event.target.value)}
                placeholder="https://drive.google.com/..."
                className="border-[#D8CFC1] bg-[#FDF9F3]"
              />
            </div>
            <div
              data-testid="editor-approval-note"
              className="flex gap-2 rounded-sm border border-[#D8CFC1] bg-[#F7F1E7] p-3 text-xs leading-5 text-[#6B5A4E]"
            >
              <Clock3 size={15} className="mt-0.5 shrink-0 text-[#FF5722]" />
              Save as a draft first, then move the story through approval when it is ready.
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse justify-between gap-3 border-t border-[#E5DFD5] bg-[#F7F1E7] px-5 py-4 md:flex-row md:items-center md:px-7">
          <span
            data-testid="editor-shortcut-note"
            className="font-mono text-[10px] uppercase tracking-wider text-[#948275]"
          >
            Fields marked by your workflow
          </span>
          <div className="flex gap-2">
            <Button data-testid="editor-cancel-button" onClick={onClose} variant="ghost">
              Cancel
            </Button>
            <Button
              data-testid="editor-save-button"
              onClick={onSave}
              disabled={!form.title.trim()}
              className="bg-[#FF5722] font-bold text-white hover:bg-[#E64A19]"
            >
              <Check size={16} />
              {editingId ? "Save changes" : "Add to plan"}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function EmptyState({
  text,
  action,
  onClick,
  "data-testid": testId,
}: {
  text: string;
  action: string;
  onClick: () => void;
  "data-testid": string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex min-h-40 flex-col items-center justify-center p-6 text-center"
    >
      <div className="grid size-10 place-items-center rounded-full bg-[#F2ECE1] text-[#FF5722]">
        <Sparkles size={17} />
      </div>
      <p data-testid={`${testId}-text`} className="mt-3 text-sm text-[#6B5A4E]">
        {text}
      </p>
      <button
        data-testid={`${testId}-action`}
        onClick={onClick}
        className="mt-3 font-mono text-[10px] font-bold uppercase tracking-wider text-[#FF5722] hover:underline"
      >
        {action} <ArrowUpRight className="inline" size={12} />
      </button>
    </div>
  );
}
