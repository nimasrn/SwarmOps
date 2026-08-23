import { jsx as e, jsxs as d, Fragment as Y } from "react/jsx-runtime";
import { forwardRef as Ee, useState as S, useId as q, Fragment as Ge, useRef as L, useMemo as H, useEffect as Z, useCallback as O, createContext as pe, useContext as fe, useLayoutEffect as Ke, createElement as We } from "react";
import { Wallet as He, User as Ye, Video as Ze, Upload as Ve, TrendingUp as je, TrendingDown as Je, Trash2 as Qe, Sun as Xe, Star as qe, Sparkles as en, CircleStop as nn, LogOut as an, Share2 as ln, Settings as tn, Send as sn, Search as rn, Plus as cn, Play as on, Pause as dn, Paperclip as mn, Moon as un, Minus as hn, Mic as _n, Menu as pn, Loader as fn, Info as Nn, Home as bn, Heart as vn, Filter as gn, Eye as yn, ExternalLink as kn, Pencil as wn, Download as Cn, FileText as Sn, CircleAlert as Tn, Copy as xn, X as An, Clock as Dn, ChevronUp as En, ChevronRight as Mn, ChevronDown as Ln, ChevronLeft as zn, CircleCheck as $n, Check as In, Camera as Pn, Calendar as Bn, Bookmark as Rn, Bell as Fn, ArrowRight as On, AlertTriangle as Un } from "lucide-react";
import { createPortal as re } from "react-dom";
const N = (...n) => n.filter(Boolean).join(" "), Me = {
  alert: Un,
  "arrow-forward": On,
  bell: Fn,
  bookmark: Rn,
  calendar: Bn,
  camera: Pn,
  check: In,
  "check-circle": $n,
  "chevron-back": zn,
  "chevron-down": Ln,
  "chevron-forward": Mn,
  "chevron-up": En,
  clock: Dn,
  close: An,
  copy: xn,
  danger: Tn,
  document: Sn,
  download: Cn,
  edit: wn,
  external: kn,
  eye: yn,
  filter: gn,
  heart: vn,
  home: bn,
  info: Nn,
  loading: fn,
  menu: pn,
  mic: _n,
  minus: hn,
  moon: un,
  paperclip: mn,
  pause: dn,
  play: on,
  plus: cn,
  search: rn,
  send: sn,
  settings: tn,
  share: ln,
  "sign-out": an,
  stop: nn,
  sparkle: en,
  star: qe,
  sun: Xe,
  trash: Qe,
  "trend-down": Je,
  "trend-up": je,
  upload: Ve,
  video: Ze,
  user: Ye,
  wallet: He
}, Gn = /* @__PURE__ */ new Set([
  "arrow-forward",
  "chevron-back",
  "chevron-forward",
  "external",
  "send",
  "share",
  "sign-out"
]), ye = { xs: 14, sm: 16, md: 20, lg: 24, xl: 32 };
function w({ className: n, label: l, name: i, size: a = "md", tone: t = "default", ...s }) {
  const o = Me[i];
  return /* @__PURE__ */ e(
    o,
    {
      "aria-hidden": l ? void 0 : !0,
      "aria-label": l,
      className: N("nim-icon", n),
      "data-flip": Gn.has(i) ? "true" : void 0,
      "data-tone": t === "default" ? void 0 : t,
      focusable: "false",
      height: ye[a],
      role: l ? "img" : void 0,
      strokeWidth: 1.75,
      width: ye[a],
      ...s
    }
  );
}
const Va = Object.keys(Me), Kn = { sm: "sm", md: "md", lg: "md" }, R = Ee(function({ className: l, label: i, name: a, size: t = "md", type: s = "button", variant: o = "ghost", ...c }, r) {
  return /* @__PURE__ */ e(
    "button",
    {
      "aria-label": i,
      className: N("nim-icon-button", `nim-icon-button--${o}`, `nim-icon-button--${t}`, l),
      ref: r,
      title: i,
      type: s,
      ...c,
      children: /* @__PURE__ */ e(w, { name: a, size: Kn[t] })
    }
  );
}), Wn = {
  close: "Close menu",
  menu: "Open menu",
  nav: "Admin navigation"
};
function ja({
  brand: n,
  children: l,
  className: i,
  groups: a,
  labels: t,
  sidebarFooter: s,
  title: o,
  toolbar: c,
  value: r
}) {
  const u = { ...Wn, ...t }, [h, _] = S(!1), m = /* @__PURE__ */ e("nav", { "aria-label": u.nav, className: "nim-admin__nav", children: a.map((p) => /* @__PURE__ */ d("div", { className: "nim-admin__group", children: [
    /* @__PURE__ */ d("p", { className: "nim-admin__group-label", children: [
      p.icon ? /* @__PURE__ */ e(w, { name: p.icon, size: "xs" }) : null,
      p.label
    ] }),
    p.items.map((f) => {
      const v = f.key === r, b = /* @__PURE__ */ d(Y, { children: [
        f.icon ? /* @__PURE__ */ e(w, { name: f.icon, size: "sm" }) : null,
        /* @__PURE__ */ e("span", { children: f.label })
      ] }), y = {
        "aria-current": v ? "page" : void 0,
        className: "nim-admin__link",
        "data-active": v ? "true" : void 0,
        onClick: () => {
          var k;
          (k = f.onSelect) == null || k.call(f), _(!1);
        }
      };
      return f.href ? /* @__PURE__ */ e("a", { href: f.href, ...y, children: b }, f.key) : /* @__PURE__ */ e("button", { type: "button", ...y, children: b }, f.key);
    })
  ] }, p.key)) });
  return /* @__PURE__ */ d("div", { className: N("nim-admin", i), "data-drawer": h ? "open" : void 0, children: [
    /* @__PURE__ */ d("aside", { className: "nim-admin__sidebar", children: [
      n ? /* @__PURE__ */ e("div", { className: "nim-admin__brand", children: n }) : null,
      m,
      s ? /* @__PURE__ */ e("div", { className: "nim-admin__sidebar-foot", children: s }) : null
    ] }),
    /* @__PURE__ */ d("div", { className: "nim-admin__drawer", hidden: !h, children: [
      /* @__PURE__ */ e("div", { className: "nim-admin__scrim", onClick: () => _(!1) }),
      /* @__PURE__ */ d("div", { className: "nim-admin__drawer-panel", children: [
        /* @__PURE__ */ d("div", { className: "nim-admin__drawer-head", children: [
          n,
          /* @__PURE__ */ e(R, { label: u.close, name: "close", onClick: () => _(!1), size: "sm" })
        ] }),
        m
      ] })
    ] }),
    /* @__PURE__ */ d("div", { className: "nim-admin__workspace", children: [
      /* @__PURE__ */ d("header", { className: "nim-admin__topbar", children: [
        /* @__PURE__ */ e(
          R,
          {
            "aria-expanded": h,
            className: "nim-admin__menu",
            label: u.menu,
            name: "menu",
            onClick: () => _(!0),
            size: "sm"
          }
        ),
        o ? /* @__PURE__ */ e("h1", { className: "nim-admin__title", children: o }) : null,
        c ? /* @__PURE__ */ e("div", { className: "nim-admin__toolbar", children: c }) : null
      ] }),
      /* @__PURE__ */ e("main", { className: "nim-admin__main", children: l })
    ] })
  ] });
}
function Ja({
  actions: n,
  back: l,
  className: i,
  meta: a,
  status: t,
  subtitle: s,
  title: o
}) {
  return /* @__PURE__ */ d("header", { className: N("nim-detail-header", i), children: [
    l ? l.href ? /* @__PURE__ */ d("a", { className: "nim-detail-header__back", href: l.href, children: [
      /* @__PURE__ */ e(w, { name: "chevron-back", size: "sm" }),
      l.label
    ] }) : /* @__PURE__ */ d("button", { className: "nim-detail-header__back", onClick: l.onClick, type: "button", children: [
      /* @__PURE__ */ e(w, { name: "chevron-back", size: "sm" }),
      l.label
    ] }) : null,
    /* @__PURE__ */ d("div", { className: "nim-detail-header__row", children: [
      /* @__PURE__ */ d("div", { className: "nim-detail-header__text", children: [
        /* @__PURE__ */ d("div", { className: "nim-detail-header__headline", children: [
          /* @__PURE__ */ e("h1", { className: "nim-detail-header__title", children: o }),
          t ? /* @__PURE__ */ e("span", { className: "nim-detail-header__status", children: t }) : null
        ] }),
        s ? /* @__PURE__ */ e("p", { className: "nim-detail-header__subtitle", children: s }) : null,
        a ? /* @__PURE__ */ e("p", { className: "nim-detail-header__meta", children: a }) : null
      ] }),
      n ? /* @__PURE__ */ e("div", { className: "nim-detail-header__actions", children: n }) : null
    ] })
  ] });
}
function Qa({
  chips: n,
  className: l,
  clearLabel: i,
  labels: a,
  onClearAll: t
}) {
  if (n.length === 0) return null;
  const s = {
    remove: (o) => `Remove filter ${o}`,
    toolbar: "Active filters",
    ...a
  };
  return /* @__PURE__ */ d("div", { "aria-label": s.toolbar, className: N("nim-filter-chips", l), role: "toolbar", children: [
    n.map((o) => /* @__PURE__ */ d("span", { className: "nim-filter-chip", children: [
      /* @__PURE__ */ d("span", { className: "nim-filter-chip__label", children: [
        o.label,
        o.value !== void 0 ? /* @__PURE__ */ d(Y, { children: [
          ": ",
          o.value
        ] }) : null
      ] }),
      /* @__PURE__ */ e(
        "button",
        {
          "aria-label": s.remove(typeof o.label == "string" ? o.label : o.key),
          className: "nim-filter-chip__remove",
          onClick: o.onRemove,
          type: "button",
          children: /* @__PURE__ */ e(w, { name: "close", size: "xs" })
        }
      )
    ] }, o.key)),
    t && i ? /* @__PURE__ */ e("button", { className: "nim-filter-chips__clear", onClick: t, type: "button", children: i }) : null
  ] });
}
function Xa({ className: n, empty: l, events: i, locale: a }) {
  const t = new Intl.DateTimeFormat(a, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  });
  return i.length === 0 ? /* @__PURE__ */ e("div", { className: N("nim-activity", n), children: l }) : /* @__PURE__ */ e("ol", { className: N("nim-activity", n), children: i.map((s) => /* @__PURE__ */ d("li", { className: "nim-activity__item", "data-tone": s.tone, children: [
    /* @__PURE__ */ e("span", { className: "nim-activity__marker", children: s.icon ? /* @__PURE__ */ e(w, { name: s.icon, size: "xs" }) : null }),
    /* @__PURE__ */ d("div", { className: "nim-activity__body", children: [
      /* @__PURE__ */ d("p", { className: "nim-activity__action", children: [
        s.actor ? /* @__PURE__ */ e("strong", { children: s.actor }) : null,
        " ",
        s.action,
        " ",
        s.target ? /* @__PURE__ */ e("span", { className: "nim-activity__target", children: s.target }) : null
      ] }),
      s.at ? /* @__PURE__ */ e("time", { className: "nim-activity__time", dateTime: s.at, children: t.format(new Date(s.at)) }) : null
    ] })
  ] }, s.id)) });
}
function qa({
  className: n,
  defaultOpen: l = [],
  items: i,
  mode: a = "multiple",
  onOpenChange: t,
  open: s,
  variant: o = "panel"
}) {
  const c = q(), [r, u] = S(l), h = s ?? r, _ = (m) => {
    const p = h.includes(m), f = a === "single" ? p ? [] : [m] : p ? h.filter((v) => v !== m) : [...h, m];
    s || u(f), t == null || t(f);
  };
  return /* @__PURE__ */ e("div", { className: N("nim-accordion", `nim-accordion--${o}`, n), children: i.map((m) => {
    const p = h.includes(m.id), f = `${c}-${m.id}`;
    return /* @__PURE__ */ d("div", { className: "nim-accordion__item", "data-open": p || void 0, children: [
      /* @__PURE__ */ d(
        "button",
        {
          "aria-controls": f,
          "aria-expanded": p,
          className: "nim-accordion__trigger",
          disabled: m.disabled,
          id: `${f}-trigger`,
          onClick: () => _(m.id),
          type: "button",
          children: [
            /* @__PURE__ */ e("span", { className: "nim-accordion__title", children: m.title }),
            m.meta ? /* @__PURE__ */ e("span", { className: "nim-accordion__meta", children: m.meta }) : null,
            /* @__PURE__ */ e(w, { className: "nim-accordion__chevron", name: "chevron-down", size: "sm" })
          ]
        }
      ),
      /* @__PURE__ */ e(
        "div",
        {
          "aria-labelledby": `${f}-trigger`,
          className: "nim-accordion__panel",
          id: f,
          role: "region",
          children: /* @__PURE__ */ e(
            "div",
            {
              className: "nim-accordion__panel-inner",
              inert: p ? void 0 : "",
              children: m.content
            }
          )
        }
      )
    ] }, m.id);
  }) });
}
function Hn({ className: n, items: l, label: i, renderItem: a, value: t }) {
  return /* @__PURE__ */ e("nav", { "aria-label": i, className: N("nim-tab-bar", n), children: /* @__PURE__ */ e("div", { className: "nim-tab-bar__row", style: { "--nim-tab-count": l.length }, children: l.map((s) => {
    const o = s.key === t, c = /* @__PURE__ */ d(Y, { children: [
      /* @__PURE__ */ e(w, { name: s.icon, size: s.center ? "lg" : "md" }),
      /* @__PURE__ */ e("span", { className: "nim-tab-bar__label", children: s.label })
    ] }), r = {
      "aria-current": o ? "page" : void 0,
      "aria-label": s.fullLabel ?? s.label,
      className: N("nim-tab-bar__item", s.center && "nim-tab-bar__item--center"),
      "data-active": o ? "true" : void 0
    };
    return a ? /* @__PURE__ */ e("div", { className: "nim-tab-bar__slot", children: a(s, c, r) }, s.key) : s.href ? /* @__PURE__ */ e("a", { href: s.href, ...r, children: c }, s.key) : /* @__PURE__ */ e("button", { onClick: s.onSelect, type: "button", ...r, children: c }, s.key);
  }) }) });
}
function ei({ children: n, className: l, header: i, tabs: a }) {
  return /* @__PURE__ */ d("div", { className: N("nim-app-shell", l), children: [
    i ? /* @__PURE__ */ e("header", { className: "nim-app-shell__header", children: i }) : null,
    /* @__PURE__ */ e("main", { className: "nim-app-shell__content", "data-has-tabs": a ? "true" : void 0, children: n }),
    a ? /* @__PURE__ */ e(Hn, { ...a }) : null
  ] });
}
const J = Ee(function({
  children: l,
  className: i,
  disabled: a = !1,
  fullWidth: t = !1,
  iconEnd: s,
  iconStart: o,
  loading: c = !1,
  size: r = "md",
  type: u = "button",
  variant: h = "primary",
  ..._
}, m) {
  return /* @__PURE__ */ d(
    "button",
    {
      "aria-busy": c || void 0,
      className: N(
        "nim-button",
        `nim-button--${h}`,
        `nim-button--${r}`,
        t && "nim-button--full",
        c && "nim-button--loading",
        i
      ),
      disabled: a || c,
      ref: m,
      type: u,
      ..._,
      children: [
        c ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-button__spinner" }) : null,
        !c && o ? /* @__PURE__ */ e(w, { name: o, size: "sm" }) : null,
        /* @__PURE__ */ e("span", { className: "nim-button__label", children: l }),
        s ? /* @__PURE__ */ e(w, { name: s, size: "sm" }) : null
      ]
    }
  );
});
function me({
  action: n,
  back: l,
  brand: i,
  children: a,
  className: t,
  footer: s,
  subtitle: o,
  title: c
}) {
  return /* @__PURE__ */ d("section", { className: N("nim-auth", t), children: [
    i ? /* @__PURE__ */ e("div", { className: "nim-auth__brand", children: i }) : null,
    /* @__PURE__ */ d("div", { className: "nim-auth__body", children: [
      l ? /* @__PURE__ */ e(J, { className: "nim-auth__back", iconStart: "chevron-back", onClick: l.onClick, size: "sm", variant: "ghost", children: l.label }) : null,
      /* @__PURE__ */ e("h1", { className: "nim-auth__title", children: c }),
      o ? /* @__PURE__ */ e("p", { className: "nim-auth__subtitle", children: o }) : null,
      /* @__PURE__ */ e("div", { className: "nim-auth__fields", children: a })
    ] }),
    /* @__PURE__ */ d("div", { className: "nim-auth__foot", children: [
      n ? /* @__PURE__ */ e(
        J,
        {
          disabled: n.disabled,
          fullWidth: !0,
          loading: n.loading,
          onClick: n.onClick,
          size: "lg",
          variant: "accent",
          children: n.label
        }
      ) : null,
      s ? /* @__PURE__ */ e("div", { className: "nim-auth__footer", children: s }) : null
    ] })
  ] });
}
const Yn = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((l) => {
  var i;
  return ((i = l[0]) == null ? void 0 : i.toUpperCase()) ?? "";
}).join("");
function Zn({ className: n, name: l, shape: i = "round", size: a = "md", src: t, ...s }) {
  return /* @__PURE__ */ d(
    "span",
    {
      className: N("nim-avatar", a !== "md" && `nim-avatar--${a}`, i === "square" && "nim-avatar--square", n),
      ...s,
      children: [
        t ? /* @__PURE__ */ e("img", { alt: "", src: t }) : /* @__PURE__ */ e("span", { "aria-hidden": "true", children: Yn(l) }),
        /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: l })
      ]
    }
  );
}
function ni({
  caption: n,
  className: l,
  initials: i,
  label: a,
  size: t = 96,
  src: s,
  value: o
}) {
  const c = Math.max(4, Math.round(t * 0.05)), r = (t - c) / 2, u = 2 * Math.PI * r, h = Math.min(100, Math.max(0, o)) / 100 * u;
  return /* @__PURE__ */ d(
    "div",
    {
      "aria-label": a,
      className: N("nim-avatar-ring", l),
      role: "img",
      style: { "--nim-ring-size": `${t}px`, "--nim-ring-stroke": `${c}px` },
      children: [
        /* @__PURE__ */ d("svg", { "aria-hidden": "true", className: "nim-avatar-ring__arc", viewBox: `0 0 ${t} ${t}`, children: [
          /* @__PURE__ */ e(
            "circle",
            {
              className: "nim-avatar-ring__track",
              cx: t / 2,
              cy: t / 2,
              fill: "none",
              r,
              strokeWidth: c
            }
          ),
          /* @__PURE__ */ e(
            "circle",
            {
              className: "nim-avatar-ring__fill",
              cx: t / 2,
              cy: t / 2,
              fill: "none",
              r,
              strokeDasharray: `${h} ${u}`,
              strokeLinecap: "round",
              strokeWidth: c
            }
          )
        ] }),
        /* @__PURE__ */ d("span", { className: "nim-avatar-ring__face", children: [
          s ? /* @__PURE__ */ e("img", { alt: "", className: "nim-avatar-ring__image", src: s }) : /* @__PURE__ */ e("span", { className: "nim-avatar-ring__initials", children: i }),
          n && !s ? /* @__PURE__ */ e("span", { className: "nim-avatar-ring__caption", children: n }) : null
        ] })
      ]
    }
  );
}
function Vn({
  actions: n,
  avatar: l,
  chips: i,
  className: a,
  eyebrow: t,
  name: s,
  stats: o = []
}) {
  return /* @__PURE__ */ d("section", { className: N("nim-profile-header", a), children: [
    /* @__PURE__ */ d("div", { className: "nim-profile-header__identity", children: [
      l,
      /* @__PURE__ */ d("div", { className: "nim-profile-header__who", children: [
        t ? /* @__PURE__ */ e("p", { className: "nim-profile-header__eyebrow", children: t }) : null,
        /* @__PURE__ */ e("h1", { className: "nim-profile-header__name", children: s }),
        i ? /* @__PURE__ */ e("div", { className: "nim-profile-header__chips", children: i }) : null
      ] })
    ] }),
    o.length ? /* @__PURE__ */ e("dl", { className: "nim-profile-header__stats", children: o.map((c, r) => /* @__PURE__ */ d("div", { className: "nim-profile-header__stat", children: [
      /* @__PURE__ */ e("dt", { className: "nim-profile-header__stat-label", children: c.label }),
      /* @__PURE__ */ e("dd", { className: "nim-profile-header__stat-value", children: c.value })
    ] }, r)) }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-profile-header__actions", children: n }) : null
  ] });
}
function ai({
  children: n,
  className: l,
  dot: i = !1,
  pill: a = !1,
  size: t = "md",
  tone: s = "soft",
  variant: o = "neutral",
  ...c
}) {
  return /* @__PURE__ */ d(
    "span",
    {
      className: N(
        "nim-badge",
        `nim-badge--${o}`,
        `nim-badge--${s}`,
        t === "sm" && "nim-badge--sm",
        a && "nim-badge--pill",
        l
      ),
      ...c,
      children: [
        i ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-badge__dot" }) : null,
        n
      ]
    }
  );
}
const jn = {
  accent: "sparkle",
  danger: "danger",
  info: "info",
  neutral: "info",
  success: "check-circle",
  warning: "alert"
};
function Jn({
  action: n,
  children: l,
  className: i,
  icon: a,
  title: t,
  tone: s = "neutral",
  ...o
}) {
  return /* @__PURE__ */ d(
    "div",
    {
      className: N("nim-banner", `nim-banner--${s}`, i),
      role: s === "danger" ? "alert" : "status",
      ...o,
      children: [
        /* @__PURE__ */ e(w, { className: "nim-banner__icon", name: a ?? jn[s], size: "sm" }),
        /* @__PURE__ */ d("div", { className: "nim-banner__content", children: [
          t ? /* @__PURE__ */ e("p", { className: "nim-banner__title", children: t }) : null,
          /* @__PURE__ */ e("div", { children: l })
        ] }),
        n ? /* @__PURE__ */ e("div", { children: n }) : null
      ]
    }
  );
}
function ii({ className: n, items: l, label: i = "Breadcrumb" }) {
  return /* @__PURE__ */ e("nav", { "aria-label": i, className: N("nim-breadcrumb", n), children: l.map((a, t) => {
    const s = t === l.length - 1;
    return /* @__PURE__ */ d(Ge, { children: [
      t > 0 ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-breadcrumb__separator", children: /* @__PURE__ */ e(w, { name: "chevron-forward", size: "xs" }) }) : null,
      s || !a.href ? /* @__PURE__ */ e("span", { "aria-current": s ? "page" : void 0, className: "nim-breadcrumb__current", children: a.label }) : /* @__PURE__ */ e("a", { className: "nim-breadcrumb__link", href: a.href, children: a.label })
    ] }, a.label);
  }) });
}
function li({
  as: n = "article",
  children: l,
  className: i,
  footer: a,
  header: t,
  interactive: s = !1,
  padding: o = "md",
  variant: c = "default",
  ...r
}) {
  return /* @__PURE__ */ d(
    n,
    {
      className: N(
        "nim-card",
        `nim-card--${c}`,
        `nim-card--pad-${o}`,
        s && "nim-card--interactive",
        i
      ),
      ...r,
      children: [
        t ? /* @__PURE__ */ e("div", { className: "nim-card__header", children: t }) : null,
        l,
        a ? /* @__PURE__ */ e("div", { className: "nim-card__footer", children: a }) : null
      ]
    }
  );
}
function ti({
  badge: n,
  className: l,
  description: i,
  detail: a,
  disabled: t = !1,
  icon: s,
  name: o,
  onSelect: c,
  selected: r,
  title: u
}) {
  return /* @__PURE__ */ d("label", { className: N("nim-option-card", r && "nim-option-card--selected", l), children: [
    /* @__PURE__ */ e(
      "input",
      {
        checked: r,
        className: "nim-option-card__input",
        disabled: t,
        name: o,
        onChange: c,
        type: "radio"
      }
    ),
    s ? /* @__PURE__ */ e("span", { className: "nim-option-card__icon", children: /* @__PURE__ */ e(w, { name: s, size: "md" }) }) : null,
    /* @__PURE__ */ d("span", { className: "nim-option-card__text", children: [
      /* @__PURE__ */ e("span", { className: "nim-option-card__title", children: u }),
      i ? /* @__PURE__ */ e("span", { className: "nim-option-card__description", children: i }) : null,
      r && a ? /* @__PURE__ */ e("span", { className: "nim-option-card__detail", children: a }) : null
    ] }),
    n ? /* @__PURE__ */ e("span", { className: "nim-option-card__badge", children: n }) : null,
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-option-card__dot" })
  ] });
}
function si({ className: n, items: l, title: i, totals: a = [] }) {
  return /* @__PURE__ */ d("section", { className: N("nim-summary", n), children: [
    i ? /* @__PURE__ */ e("h2", { className: "nim-summary__title", children: i }) : null,
    /* @__PURE__ */ e("dl", { className: "nim-summary__lines", children: l.map((t) => /* @__PURE__ */ d("div", { className: "nim-summary__line", children: [
      /* @__PURE__ */ d("dt", { children: [
        /* @__PURE__ */ e("span", { className: "nim-summary__label", children: t.label }),
        t.meta ? /* @__PURE__ */ e("span", { className: "nim-summary__meta", children: t.meta }) : null
      ] }),
      /* @__PURE__ */ e("dd", { className: "nim-summary__value", children: t.value })
    ] }, t.key)) }),
    a.length ? /* @__PURE__ */ d(Y, { children: [
      /* @__PURE__ */ e("hr", { className: "nim-summary__rule" }),
      /* @__PURE__ */ e("dl", { className: "nim-summary__lines nim-summary__lines--totals", children: a.map((t) => /* @__PURE__ */ d(
        "div",
        {
          className: "nim-summary__line",
          "data-emphasis": t.emphasis ? "true" : void 0,
          children: [
            /* @__PURE__ */ e("dt", { children: /* @__PURE__ */ e("span", { className: "nim-summary__label", children: t.label }) }),
            /* @__PURE__ */ e("dd", { className: "nim-summary__value", children: t.value })
          ]
        },
        t.key
      )) })
    ] }) : null
  ] });
}
function ri({ action: n, className: l, note: i, total: a }) {
  return /* @__PURE__ */ d("div", { className: N("nim-action-bar", l), children: [
    /* @__PURE__ */ d("div", { className: "nim-action-bar__row", children: [
      a ? /* @__PURE__ */ d("div", { className: "nim-action-bar__total", children: [
        /* @__PURE__ */ e("span", { className: "nim-action-bar__total-label", children: a.label }),
        /* @__PURE__ */ e("strong", { className: "nim-action-bar__total-value", children: a.value })
      ] }) : null,
      /* @__PURE__ */ e("div", { className: "nim-action-bar__action", children: n })
    ] }),
    i ? /* @__PURE__ */ e("p", { className: "nim-action-bar__note", children: i }) : null
  ] });
}
function Le({ className: n, label: l = "Loading", size: i = "md", ...a }) {
  return /* @__PURE__ */ e(
    "span",
    {
      className: N("nim-spinner", i !== "md" && `nim-spinner--${i}`, n),
      role: "status",
      ...a,
      children: /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: l })
    }
  );
}
function Qn({ className: n, label: l, value: i, ...a }) {
  const t = i === void 0, s = t ? 0 : Math.min(100, Math.max(0, i));
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": l,
      "aria-valuemax": 100,
      "aria-valuemin": 0,
      "aria-valuenow": t ? void 0 : s,
      className: N("nim-progress", t && "nim-progress--indeterminate", n),
      role: "progressbar",
      ...a,
      children: /* @__PURE__ */ e("div", { className: "nim-progress__fill", style: t ? void 0 : { inlineSize: `${s}%` } })
    }
  );
}
function ci({ className: n, height: l = "1em", radius: i, width: a = "100%", ...t }) {
  return /* @__PURE__ */ e(
    "span",
    {
      "aria-hidden": "true",
      className: N("nim-skeleton", n),
      style: { blockSize: l, borderRadius: i, inlineSize: a },
      ...t
    }
  );
}
const Xn = {
  download: "Download",
  failed: "Not delivered",
  pause: "Pause",
  play: "Play",
  read: "Read",
  sending: "Sending",
  sent: "Sent",
  today: "Today",
  typing: "is typing",
  yesterday: "Yesterday",
  voiceMessage: "Voice message"
}, ke = 1024;
function qn(n, l) {
  const i = ["B", "KB", "MB", "GB"];
  let a = n, t = 0;
  for (; a >= ke && t < i.length - 1; )
    a /= ke, t += 1;
  return `${new Intl.NumberFormat(l, { maximumFractionDigits: t === 0 ? 0 : 1 }).format(a)} ${i[t]}`;
}
function ze(n, l) {
  const i = new Intl.NumberFormat(l, { minimumIntegerDigits: 2, useGrouping: !1 }), a = Math.max(0, Math.round(n));
  return `${new Intl.NumberFormat(l).format(Math.floor(a / 60))}:${i.format(a % 60)}`;
}
function ea({
  attachment: n,
  labels: l,
  locale: i
}) {
  const a = L(null), [t, s] = S(!1), [o, c] = S(0), r = n.duration ?? 0, u = H(
    () => n.waveform ?? Array.from({ length: 32 }, (_, m) => 0.35 + m * 7 % 11 / 18),
    [n.waveform]
  ), h = r > 0 ? Math.min(1, o / r) : 0;
  return /* @__PURE__ */ d("div", { className: "nim-chat-voice", children: [
    /* @__PURE__ */ e(
      R,
      {
        label: t ? l.pause : l.play,
        name: t ? "pause" : "play",
        onClick: () => {
          const _ = a.current;
          _ && (_.paused ? _.play() : _.pause());
        },
        size: "sm",
        variant: "solid"
      }
    ),
    /* @__PURE__ */ e(
      "div",
      {
        "aria-label": l.voiceMessage,
        className: "nim-chat-voice__wave",
        "aria-hidden": "true",
        children: u.map((_, m) => /* @__PURE__ */ e(
          "span",
          {
            className: "nim-chat-voice__bar",
            "data-played": m / u.length <= h ? "true" : void 0,
            style: { blockSize: `${Math.round(_ * 100)}%` }
          },
          m
        ))
      }
    ),
    /* @__PURE__ */ e("span", { className: "nim-chat-voice__time", children: ze(t || o ? Math.max(0, r - o) : r, i) }),
    /* @__PURE__ */ e(
      "audio",
      {
        onEnded: () => {
          s(!1), c(0);
        },
        onPause: () => s(!1),
        onPlay: () => s(!0),
        onTimeUpdate: (_) => c(_.currentTarget.currentTime),
        preload: "metadata",
        ref: a,
        src: n.url
      }
    )
  ] });
}
function na({
  attachment: n,
  labels: l,
  locale: i
}) {
  return n.kind === "voice" ? /* @__PURE__ */ e(ea, { attachment: n, labels: l, locale: i }) : n.kind === "video" ? /* @__PURE__ */ d("figure", { className: "nim-chat-media", children: [
    /* @__PURE__ */ e("video", { controls: !0, playsInline: !0, poster: n.poster, preload: "metadata", src: n.url }),
    n.duration ? /* @__PURE__ */ e("figcaption", { className: "nim-chat-media__meta", children: ze(n.duration, i) }) : null
  ] }) : n.kind === "image" ? /* @__PURE__ */ e("figure", { className: "nim-chat-media", children: /* @__PURE__ */ e("img", { alt: n.name ?? "", loading: "lazy", src: n.url }) }) : /* @__PURE__ */ d(
    "a",
    {
      className: "nim-chat-file",
      download: n.name,
      href: n.url,
      rel: "noreferrer",
      target: "_blank",
      children: [
        /* @__PURE__ */ e("span", { className: "nim-chat-file__icon", children: /* @__PURE__ */ e(w, { name: "document", size: "md" }) }),
        /* @__PURE__ */ d("span", { className: "nim-chat-file__text", children: [
          /* @__PURE__ */ e("span", { className: "nim-chat-file__name", children: n.name ?? l.download }),
          n.size !== void 0 ? /* @__PURE__ */ e("span", { className: "nim-chat-file__size", children: qn(n.size, i) }) : null
        ] }),
        /* @__PURE__ */ e(w, { className: "nim-chat-file__action", name: "download", size: "sm" })
      ]
    }
  );
}
function oi({
  className: n,
  composer: l,
  footer: i,
  header: a,
  labels: t,
  locale: s,
  messages: o,
  typing: c
}) {
  const r = { ...Xn, ...t }, u = L(null), h = L(!0), _ = H(
    () => new Intl.DateTimeFormat(s, { hour: "2-digit", minute: "2-digit" }),
    [s]
  );
  return Z(() => {
    const m = u.current;
    !m || !h.current || (m.scrollTop = m.scrollHeight);
  }, [o, c]), /* @__PURE__ */ d("section", { className: N("nim-chat", n), children: [
    a ? /* @__PURE__ */ e("header", { className: "nim-chat__header", children: a }) : null,
    /* @__PURE__ */ d(
      "div",
      {
        className: "nim-chat__scroll",
        onScroll: (m) => {
          const p = m.currentTarget;
          h.current = p.scrollHeight - p.scrollTop - p.clientHeight < 48;
        },
        ref: u,
        children: [
          /* @__PURE__ */ e("ol", { "aria-live": "polite", className: "nim-chat__list", children: o.map((m) => {
            var p;
            return /* @__PURE__ */ d(
              "li",
              {
                className: N("nim-chat-message", m.own && "nim-chat-message--own"),
                children: [
                  !m.own && m.author ? /* @__PURE__ */ e(
                    Zn,
                    {
                      className: "nim-chat-message__avatar",
                      name: m.author.name,
                      size: "sm",
                      src: m.author.avatar
                    }
                  ) : null,
                  /* @__PURE__ */ d("div", { className: "nim-chat-message__stack", children: [
                    !m.own && m.author ? /* @__PURE__ */ e("span", { className: "nim-chat-message__author", children: m.author.name }) : null,
                    /* @__PURE__ */ d("div", { className: "nim-chat-message__bubble", children: [
                      (p = m.attachments) == null ? void 0 : p.map((f, v) => /* @__PURE__ */ e(
                        na,
                        {
                          attachment: f,
                          labels: r,
                          locale: s
                        },
                        `${m.id}-${v}`
                      )),
                      m.text ? /* @__PURE__ */ e("p", { className: "nim-chat-message__text", children: m.text }) : null
                    ] }),
                    /* @__PURE__ */ d("span", { className: "nim-chat-message__meta", children: [
                      m.at ? /* @__PURE__ */ e("time", { dateTime: m.at, children: _.format(new Date(m.at)) }) : null,
                      m.own && m.status ? /* @__PURE__ */ e("span", { className: "nim-chat-message__status", "data-status": m.status, children: m.status === "sending" ? /* @__PURE__ */ e(Le, { size: "sm" }) : /* @__PURE__ */ e(
                        w,
                        {
                          label: r[m.status],
                          name: m.status === "failed" ? "danger" : "check-circle",
                          size: "xs"
                        }
                      ) }) : null
                    ] })
                  ] })
                ]
              },
              m.id
            );
          }) }),
          c ? /* @__PURE__ */ d("p", { className: "nim-chat__typing", children: [
            typeof c == "string" ? `${c} ${r.typing}` : r.typing,
            /* @__PURE__ */ d("span", { "aria-hidden": "true", className: "nim-chat__dots", children: [
              /* @__PURE__ */ e("i", {}),
              /* @__PURE__ */ e("i", {}),
              /* @__PURE__ */ e("i", {})
            ] })
          ] }) : null,
          i ? /* @__PURE__ */ e("div", { className: "nim-chat__footer", children: i }) : null
        ]
      }
    ),
    l ? /* @__PURE__ */ e("div", { className: "nim-chat__composer", children: l }) : null
  ] });
}
const aa = {
  attach: "Attach a file",
  cancel: "Cancel recording",
  discard: "Remove attachment",
  record: "Record a voice message",
  recording: "Recording",
  send: "Send",
  stop: "Stop and attach",
  video: "Attach a video"
}, ia = () => {
  var n;
  return typeof navigator < "u" && typeof window < "u" && "MediaRecorder" in window && !!((n = navigator.mediaDevices) != null && n.getUserMedia);
}, la = (n) => n.type.startsWith("video/") ? "video" : n.type.startsWith("image/") ? "image" : "file";
function di({
  accept: n,
  allow: l,
  className: i,
  disabled: a = !1,
  labels: t,
  onFiles: s,
  onSend: o,
  placeholder: c
}) {
  const r = { ...aa, ...t }, u = { file: !0, video: !0, voice: !0, ...l }, [h, _] = S(""), [m, p] = S([]), [f, v] = S(!1), [b, y] = S(0), [k] = S(ia), A = L([]), z = L(null), F = L(null), C = L(null), P = L(0), T = L([]), E = L(null), x = O(() => {
    var g;
    (g = C.current) == null || g.stream.getTracks().forEach((D) => D.stop()), C.current = null;
  }, []);
  Z(() => x, [x]), Z(() => {
    if (!f) return;
    const g = window.setInterval(() => y((Date.now() - P.current) / 1e3), 200);
    return () => window.clearInterval(g);
  }, [f]);
  const I = O(
    (g) => {
      if (!(g != null && g.length)) return;
      const D = Array.from(g);
      A.current = [...A.current, ...D], p((M) => [
        ...M,
        ...D.map(($) => ({
          kind: la($),
          name: $.name,
          size: $.size,
          url: URL.createObjectURL($)
        }))
      ]);
    },
    []
  ), B = O(async () => {
    try {
      const g = await navigator.mediaDevices.getUserMedia({ audio: !0 }), D = new MediaRecorder(g);
      T.current = [], D.ondataavailable = (M) => {
        M.data.size && T.current.push(M.data);
      }, D.onstop = () => {
        const M = new Blob(T.current, { type: D.mimeType }), $ = new File([M], "voice-message", { type: D.mimeType });
        A.current = [...A.current, $], p((U) => [
          ...U,
          {
            duration: (Date.now() - P.current) / 1e3,
            kind: "voice",
            size: M.size,
            url: URL.createObjectURL(M)
          }
        ]), x();
      }, C.current = D, D.start(), P.current = Date.now(), y(0), v(!0);
    } catch {
      v(!1), x();
    }
  }, [x]), K = O(
    (g) => {
      const D = C.current;
      v(!1), D && (g || (D.onstop = x), D.stop());
    },
    [x]
  ), j = (g) => {
    p((D) => (URL.revokeObjectURL(D[g].url), D.filter((M, $) => $ !== g))), A.current = A.current.filter((D, M) => M !== g);
  }, W = () => {
    var g;
    !h.trim() && m.length === 0 || (o({ attachments: m, text: h.trim() }), s == null || s(A.current), A.current = [], p([]), _(""), (g = E.current) == null || g.focus());
  }, V = !h.trim() && m.length === 0;
  return /* @__PURE__ */ d("div", { className: N("nim-composer", i), children: [
    m.length ? /* @__PURE__ */ e("ul", { className: "nim-composer__tray", children: m.map((g, D) => /* @__PURE__ */ d("li", { className: "nim-composer__chip", children: [
      /* @__PURE__ */ e(
        w,
        {
          name: g.kind === "voice" ? "mic" : g.kind === "video" ? "video" : g.kind === "image" ? "camera" : "document",
          size: "xs"
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-composer__chip-name", children: g.name ?? r.record }),
      /* @__PURE__ */ e(
        R,
        {
          label: r.discard,
          name: "close",
          onClick: () => j(D),
          size: "sm"
        }
      )
    ] }, g.url)) }) : null,
    /* @__PURE__ */ e("div", { className: "nim-composer__row", children: f ? /* @__PURE__ */ d("div", { className: "nim-composer__recording", role: "status", children: [
      /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-composer__pulse" }),
      /* @__PURE__ */ e("span", { className: "nim-composer__recording-label", children: r.recording }),
      /* @__PURE__ */ d("span", { className: "nim-composer__elapsed", children: [
        b.toFixed(1),
        "s"
      ] }),
      /* @__PURE__ */ e(
        R,
        {
          label: r.cancel,
          name: "close",
          onClick: () => K(!1),
          size: "sm"
        }
      ),
      /* @__PURE__ */ e(
        R,
        {
          label: r.stop,
          name: "stop",
          onClick: () => K(!0),
          size: "sm",
          variant: "solid"
        }
      )
    ] }) : /* @__PURE__ */ d(Y, { children: [
      u.file ? /* @__PURE__ */ e(
        R,
        {
          disabled: a,
          label: r.attach,
          name: "paperclip",
          onClick: () => {
            var g;
            return (g = z.current) == null ? void 0 : g.click();
          },
          size: "sm"
        }
      ) : null,
      u.video ? /* @__PURE__ */ e(
        R,
        {
          disabled: a,
          label: r.video,
          name: "video",
          onClick: () => {
            var g;
            return (g = F.current) == null ? void 0 : g.click();
          },
          size: "sm"
        }
      ) : null,
      /* @__PURE__ */ e(
        "textarea",
        {
          className: "nim-composer__input",
          disabled: a,
          onChange: (g) => _(g.target.value),
          onKeyDown: (g) => {
            g.key === "Enter" && !g.shiftKey && (g.preventDefault(), W());
          },
          placeholder: c,
          ref: E,
          rows: 1,
          value: h
        }
      ),
      u.voice && k && V ? /* @__PURE__ */ e(
        R,
        {
          disabled: a,
          label: r.record,
          name: "mic",
          onClick: () => void B(),
          size: "sm"
        }
      ) : /* @__PURE__ */ e(
        R,
        {
          disabled: a || V,
          label: r.send,
          name: "send",
          onClick: W,
          size: "sm",
          variant: "solid"
        }
      )
    ] }) }),
    /* @__PURE__ */ e(
      "input",
      {
        accept: n,
        className: "nim-visually-hidden",
        multiple: !0,
        onChange: (g) => {
          I(g.target.files), g.target.value = "";
        },
        ref: z,
        tabIndex: -1,
        type: "file"
      }
    ),
    /* @__PURE__ */ e(
      "input",
      {
        accept: "video/*",
        className: "nim-visually-hidden",
        onChange: (g) => {
          I(g.target.files), g.target.value = "";
        },
        ref: F,
        tabIndex: -1,
        type: "file"
      }
    )
  ] });
}
function mi({ children: n, className: l, description: i, ...a }) {
  return /* @__PURE__ */ d("label", { className: N("nim-choice nim-choice--checkbox", l), children: [
    /* @__PURE__ */ e("input", { className: "nim-choice__input", type: "checkbox", ...a }),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-checkbox__box", children: /* @__PURE__ */ e(w, { name: "check", size: "xs" }) }),
    /* @__PURE__ */ d("span", { className: "nim-choice__text", children: [
      n,
      i ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: i }) : null
    ] })
  ] });
}
function ta({ children: n, className: l, description: i, ...a }) {
  return /* @__PURE__ */ d("label", { className: N("nim-choice nim-choice--switch", l), children: [
    /* @__PURE__ */ e("input", { className: "nim-choice__input", role: "switch", type: "checkbox", ...a }),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-switch__track", children: /* @__PURE__ */ e("span", { className: "nim-switch__thumb" }) }),
    /* @__PURE__ */ d("span", { className: "nim-choice__text", children: [
      n,
      i ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: i }) : null
    ] })
  ] });
}
function ui({ children: n, className: l, description: i, ...a }) {
  const t = fe($e);
  return /* @__PURE__ */ d("label", { className: N("nim-choice nim-choice--radio", l), children: [
    /* @__PURE__ */ e(
      "input",
      {
        ...a,
        checked: t ? t.value === a.value : a.checked,
        className: "nim-choice__input",
        name: (t == null ? void 0 : t.name) ?? a.name,
        onChange: (s) => {
          var o;
          t == null || t.onChange(s.target.value), (o = a.onChange) == null || o.call(a, s);
        },
        type: "radio"
      }
    ),
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-radio__mark" }),
    /* @__PURE__ */ d("span", { className: "nim-choice__text", children: [
      n,
      i ? /* @__PURE__ */ e("span", { className: "nim-choice__description", children: i }) : null
    ] })
  ] });
}
const $e = pe(null);
function hi({
  children: n,
  className: l,
  error: i,
  hint: a,
  label: t,
  layout: s = "stack",
  name: o,
  onChange: c,
  value: r
}) {
  const u = q(), h = o ?? `nim-radio-${u}`, _ = a ? `${h}-hint` : void 0, m = i ? `${h}-error` : void 0;
  return /* @__PURE__ */ e($e.Provider, { value: { name: h, onChange: c, value: r }, children: /* @__PURE__ */ d(
    "fieldset",
    {
      "aria-describedby": [m, _].filter(Boolean).join(" ") || void 0,
      "aria-invalid": i ? !0 : void 0,
      className: N("nim-radio-group", i && "nim-radio-group--invalid", l),
      children: [
        /* @__PURE__ */ e("legend", { className: "nim-radio-group__legend", children: t }),
        /* @__PURE__ */ e("div", { className: N("nim-radio-group__options", `nim-radio-group__options--${s}`), children: n }),
        i ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: m, children: i }) : null,
        a && !i ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: _, children: a }) : null
      ]
    }
  ) });
}
function sa({
  children: n,
  className: l,
  disabled: i = !1,
  icon: a,
  onClick: t,
  onRemove: s,
  removeLabel: o = "Remove",
  selected: c = !1,
  tone: r = "neutral"
}) {
  const u = !!t;
  return /* @__PURE__ */ d(
    "span",
    {
      className: N("nim-chip", u && "nim-chip--interactive", l),
      "data-selected": c || void 0,
      "data-tone": r === "neutral" ? void 0 : r,
      children: [
        u ? /* @__PURE__ */ d(
          "button",
          {
            "aria-pressed": c,
            className: "nim-chip__body",
            disabled: i,
            onClick: t,
            type: "button",
            children: [
              a ? /* @__PURE__ */ e(w, { name: a, size: "xs" }) : null,
              n
            ]
          }
        ) : /* @__PURE__ */ d("span", { className: "nim-chip__body", children: [
          a ? /* @__PURE__ */ e(w, { name: a, size: "xs" }) : null,
          n
        ] }),
        s ? /* @__PURE__ */ e(
          "button",
          {
            "aria-label": o,
            className: "nim-chip__remove",
            disabled: i,
            onClick: s,
            type: "button",
            children: /* @__PURE__ */ e(w, { name: "close", size: "xs" })
          }
        ) : null
      ]
    }
  );
}
function _i({
  className: n,
  disabled: l = !1,
  error: i,
  hint: a,
  label: t,
  onChange: s,
  placeholder: o,
  removeLabel: c = "Remove",
  separators: r = ["Enter", ",", "Tab"],
  validate: u,
  values: h
}) {
  const [_, m] = S(""), p = () => {
    const v = _.trim();
    if (v && !(u && !u(v))) {
      if (h.includes(v)) {
        m("");
        return;
      }
      s([...h, v]), m("");
    }
  }, f = (v) => {
    if (r.includes(v.key)) {
      if (v.key === "Tab" && !_.trim()) return;
      v.preventDefault(), p();
      return;
    }
    v.key === "Backspace" && !_ && h.length > 0 && s(h.slice(0, -1));
  };
  return /* @__PURE__ */ d("div", { className: N("nim-field", i && "nim-field--invalid", n), children: [
    t ? /* @__PURE__ */ e("span", { className: "nim-field__label", children: t }) : null,
    /* @__PURE__ */ d("div", { className: "nim-chip-input", "data-disabled": l || void 0, children: [
      h.map((v) => /* @__PURE__ */ e(
        sa,
        {
          disabled: l,
          onRemove: () => s(h.filter((b) => b !== v)),
          removeLabel: `${c} ${v}`,
          children: v
        },
        v
      )),
      /* @__PURE__ */ e(
        "input",
        {
          "aria-invalid": i ? !0 : void 0,
          "aria-label": t,
          className: "nim-chip-input__field",
          disabled: l,
          onBlur: p,
          onChange: (v) => m(v.target.value),
          onKeyDown: f,
          placeholder: h.length === 0 ? o : void 0,
          value: _
        }
      )
    ] }),
    i ? /* @__PURE__ */ e("p", { className: "nim-field__error", children: i }) : null,
    a && !i ? /* @__PURE__ */ e("p", { className: "nim-field__hint", children: a }) : null
  ] });
}
function pi({ className: n, layout: l = "rows", rows: i }) {
  return /* @__PURE__ */ e("dl", { className: N("nim-data-list", `nim-data-list--${l}`, n), children: i.map((a) => /* @__PURE__ */ d("div", { className: "nim-data-list__row", children: [
    /* @__PURE__ */ e("dt", { className: "nim-data-list__label", children: a.label }),
    /* @__PURE__ */ e("dd", { className: N("nim-data-list__value", a.mono && "nim-data-list__value--mono"), children: a.value ?? /* @__PURE__ */ e("span", { className: "nim-data-list__empty", children: "—" }) })
  ] }, a.id)) });
}
function X({ children: n, className: l, error: i, hint: a, id: t, label: s, required: o }) {
  const c = q(), r = t ?? `nim-${c}`, u = a ? `${r}-hint` : void 0, h = i ? `${r}-error` : void 0, _ = [h, u].filter(Boolean).join(" ") || void 0;
  return /* @__PURE__ */ d("div", { className: N("nim-field", i && "nim-field--invalid", l), children: [
    s ? /* @__PURE__ */ d("label", { className: "nim-field__label", htmlFor: r, children: [
      s,
      o ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-field__required", children: "*" }) : null
    ] }) : null,
    n({ control: r, describedBy: _ }),
    i ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: h, children: i }) : null,
    a && !i ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: u, children: a }) : null
  ] });
}
function ra({ className: n, error: l, hint: i, iconEnd: a, iconStart: t, id: s, label: o, required: c, ...r }) {
  return /* @__PURE__ */ e(X, { error: l, hint: i, id: s, label: o, required: c, children: ({ control: u, describedBy: h }) => /* @__PURE__ */ d(
    "div",
    {
      className: N(
        "nim-input-shell",
        t && "nim-input-shell--has-start",
        a && "nim-input-shell--has-end"
      ),
      children: [
        t ? /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--start", children: /* @__PURE__ */ e(w, { name: t, size: "sm" }) }) : null,
        /* @__PURE__ */ e(
          "input",
          {
            "aria-describedby": h,
            "aria-invalid": l ? !0 : void 0,
            className: N("nim-input", n),
            id: u,
            required: c,
            ...r
          }
        ),
        a ? /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(w, { name: a, size: "sm" }) }) : null
      ]
    }
  ) });
}
function fi({ className: n, error: l, hint: i, id: a, label: t, required: s, rows: o = 4, ...c }) {
  return /* @__PURE__ */ e(X, { error: l, hint: i, id: a, label: t, required: s, children: ({ control: r, describedBy: u }) => /* @__PURE__ */ e(
    "textarea",
    {
      "aria-describedby": u,
      "aria-invalid": l ? !0 : void 0,
      className: N("nim-textarea", n),
      id: r,
      required: s,
      rows: o,
      ...c
    }
  ) });
}
function Ni({
  className: n,
  error: l,
  hint: i,
  id: a,
  label: t,
  options: s,
  placeholder: o,
  required: c,
  ...r
}) {
  return /* @__PURE__ */ e(X, { error: l, hint: i, id: a, label: t, required: c, children: ({ control: u, describedBy: h }) => /* @__PURE__ */ d("div", { className: "nim-input-shell nim-input-shell--has-end", children: [
    /* @__PURE__ */ d(
      "select",
      {
        "aria-describedby": h,
        "aria-invalid": l ? !0 : void 0,
        className: N("nim-select", n),
        id: u,
        required: c,
        ...r,
        children: [
          o ? /* @__PURE__ */ e("option", { value: "", disabled: !0, children: o }) : null,
          s.map((_) => /* @__PURE__ */ e("option", { disabled: _.disabled, value: _.value, children: _.label }, _.value))
        ]
      }
    ),
    /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(w, { name: "chevron-down", size: "sm" }) })
  ] }) });
}
function bi({
  className: n,
  emptyState: l,
  error: i,
  hint: a,
  id: t,
  label: s,
  onChange: o,
  options: c,
  placeholder: r,
  required: u,
  value: h
}) {
  const _ = q(), m = c.find((T) => T.value === h) ?? null, [p, f] = S(""), [v, b] = S(!1), [y, k] = S(0), A = L(null), z = H(() => {
    const T = p.trim().toLowerCase();
    return T ? c.filter((E) => E.label.toLowerCase().includes(T)) : c;
  }, [c, p]), F = (T) => {
    o(T.value), f(""), b(!1);
  }, C = (T) => {
    if (T.key === "Escape") {
      f(""), b(!1);
      return;
    }
    if (!v && (T.key === "ArrowDown" || T.key === "ArrowUp")) {
      b(!0);
      return;
    }
    if (T.key === "ArrowDown" || T.key === "ArrowUp") {
      T.preventDefault();
      const E = T.key === "ArrowDown" ? 1 : -1, x = z.filter((I) => !I.disabled);
      if (x.length === 0) return;
      k((I) => (I + E + x.length) % x.length);
    }
    if (T.key === "Enter") {
      const x = z.filter((I) => !I.disabled)[y];
      x && (T.preventDefault(), F(x));
    }
  }, P = z.filter((T) => !T.disabled);
  return /* @__PURE__ */ e(X, { className: n, error: i, hint: a, id: t, label: s, required: u, children: ({ control: T, describedBy: E }) => /* @__PURE__ */ d("div", { className: "nim-combobox", children: [
    /* @__PURE__ */ d("div", { className: N("nim-input-shell", "nim-input-shell--has-end"), children: [
      /* @__PURE__ */ e(
        "input",
        {
          "aria-autocomplete": "list",
          "aria-controls": v ? _ : void 0,
          "aria-describedby": E,
          "aria-expanded": v,
          className: "nim-input",
          id: T,
          onBlur: () => window.setTimeout(() => b(!1), 120),
          onChange: (x) => {
            f(x.target.value), k(0), b(!0);
          },
          onFocus: () => b(!0),
          onKeyDown: C,
          placeholder: r,
          ref: A,
          role: "combobox",
          value: v ? p : (m == null ? void 0 : m.label) ?? ""
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-input-shell__affix nim-input-shell__affix--end", children: /* @__PURE__ */ e(w, { name: "chevron-down", size: "sm" }) })
    ] }),
    v ? /* @__PURE__ */ e("div", { className: "nim-combobox__list", id: _, role: "listbox", children: P.length === 0 ? /* @__PURE__ */ e("div", { className: "nim-combobox__empty", children: l ? l(p) : `Nothing matches “${p}”.` }) : z.map((x) => /* @__PURE__ */ d(
      "button",
      {
        "aria-selected": P.indexOf(x) === y,
        className: "nim-combobox__option",
        disabled: x.disabled,
        onClick: () => F(x),
        onPointerEnter: () => k(P.indexOf(x)),
        role: "option",
        type: "button",
        children: [
          /* @__PURE__ */ e("span", { children: x.label }),
          x.meta ? /* @__PURE__ */ e("span", { className: "nim-combobox__meta", children: x.meta }) : null
        ]
      },
      x.value
    )) }) : null
  ] }) });
}
function Ie(n, l, { onDismiss: i, open: a }) {
  const [t, s] = S({ left: 0, top: 0 }), o = L(null), c = O(() => {
    const r = n.current, u = l.current;
    if (!r || !u) return;
    const h = r.getBoundingClientRect(), { height: _, width: m } = u.getBoundingClientRect(), p = 4, f = 8, v = getComputedStyle(r).direction === "rtl", b = h.bottom + p, k = b + _ > window.innerHeight && h.top - p - _ > 0 ? h.top - p - _ : b, A = v ? h.right - m : h.left, z = Math.min(Math.max(A, f), window.innerWidth - m - f);
    s({ left: z, top: k });
  }, [l, n]);
  return Ke(() => {
    a && c();
  }, [a, c]), Z(() => {
    if (!a) return;
    o.current = document.activeElement;
    const r = (h) => {
      h.key === "Escape" && (h.stopPropagation(), i());
    }, u = (h) => {
      var m, p;
      const _ = h.target;
      (m = l.current) != null && m.contains(_) || (p = n.current) != null && p.contains(_) || i();
    };
    return window.addEventListener("keydown", r), window.addEventListener("pointerdown", u), window.addEventListener("resize", c), window.addEventListener("scroll", c, !0), () => {
      var h, _;
      window.removeEventListener("keydown", r), window.removeEventListener("pointerdown", u), window.removeEventListener("resize", c), window.removeEventListener("scroll", c, !0), (_ = (h = o.current) == null ? void 0 : h.focus) == null || _.call(h);
    };
  }, [i, a, l, c, n]), t;
}
const ca = (n) => n.kind === void 0 || n.kind === "action";
function vi({ children: n, className: l, items: i, label: a }) {
  const [t, s] = S(!1), [o, c] = S(0), r = L(null), u = L(null), h = Ie(r, u, { onDismiss: () => s(!1), open: t }), m = i.filter(ca).filter((b) => !b.disabled), p = () => {
    c(0), s((b) => !b);
  }, f = (b) => {
    s(!1), b.onSelect();
  }, v = (b) => {
    if (m.length !== 0) {
      if (b.key === "ArrowDown" || b.key === "ArrowUp") {
        b.preventDefault();
        const y = b.key === "ArrowDown" ? 1 : -1;
        c((k) => (k + y + m.length) % m.length);
      }
      if (b.key === "Home" && (b.preventDefault(), c(0)), b.key === "End" && (b.preventDefault(), c(m.length - 1)), b.key === "Enter" || b.key === " ") {
        b.preventDefault();
        const y = m[o];
        y && f(y);
      }
    }
  };
  return /* @__PURE__ */ d(Y, { children: [
    n({ open: t, ref: r, toggle: p }),
    t && typeof document < "u" ? re(
      /* @__PURE__ */ e(
        "div",
        {
          "aria-label": a,
          className: N("nim-menu", l),
          onKeyDown: v,
          ref: u,
          role: "menu",
          style: { insetBlockStart: h.top, insetInlineStart: h.left },
          tabIndex: -1,
          children: i.map((b, y) => b.kind === "separator" ? /* @__PURE__ */ e("hr", { className: "nim-menu__separator" }, `sep-${y}`) : b.kind === "heading" ? /* @__PURE__ */ e("p", { className: "nim-menu__label", children: b.label }, `head-${y}`) : /* @__PURE__ */ d(
            "button",
            {
              className: N("nim-menu__item", b.danger && "nim-menu__item--danger"),
              "data-active": m.indexOf(b) === o ? "true" : void 0,
              disabled: b.disabled,
              onClick: () => f(b),
              onPointerEnter: () => c(m.indexOf(b)),
              role: "menuitem",
              type: "button",
              children: [
                b.icon ? /* @__PURE__ */ e(w, { className: "nim-menu__icon", name: b.icon, size: "sm" }) : null,
                /* @__PURE__ */ e("span", { children: b.label }),
                b.shortcut ? /* @__PURE__ */ e("span", { className: "nim-menu__shortcut", children: b.shortcut }) : null
              ]
            },
            b.label
          ))
        }
      ),
      document.body
    ) : null
  ] });
}
function oa({ children: n, className: l, label: i, onClose: a, open: t, triggerRef: s }) {
  const o = L(null), c = Ie(s, o, { onDismiss: a, open: t });
  return !t || typeof document > "u" ? null : re(
    /* @__PURE__ */ e(
      "div",
      {
        "aria-label": i,
        className: N("nim-popover", l),
        ref: o,
        role: "dialog",
        style: { insetBlockStart: c.top, insetInlineStart: c.left },
        children: n
      }
    ),
    document.body
  );
}
const Pe = pe(null);
function gi({
  children: n,
  className: l,
  defaultColorway: i = "vermilion",
  defaultScheme: a = "light",
  defaultStyle: t = "ledger",
  direction: s = "ltr",
  locale: o,
  syncDocument: c = !0
}) {
  const [r, u] = S(t), [h, _] = S(i), [m, p] = S(a);
  Z(() => {
    if (!c || typeof document > "u") return;
    const v = document.documentElement;
    v.dataset.nimStyle = r, v.dataset.nimColorway = h, m === "system" ? delete v.dataset.nimScheme : v.dataset.nimScheme = m, v.dir = s, o && (v.lang = o);
  }, [h, s, o, m, r, c]);
  const f = H(
    () => ({ colorway: h, direction: s, locale: o, scheme: m, setColorway: _, setScheme: p, setStyle: u, style: r }),
    [h, s, o, m, r]
  );
  return /* @__PURE__ */ e(Pe.Provider, { value: f, children: /* @__PURE__ */ e(
    "div",
    {
      className: N("nim-root", l),
      "data-nim-colorway": h,
      "data-nim-scheme": m === "system" ? void 0 : m,
      "data-nim-style": r,
      dir: s,
      lang: o,
      children: n
    }
  ) });
}
function ce() {
  const n = fe(Pe);
  if (!n) throw new Error("useNim must be used inside <NimProvider>");
  return n;
}
function yi() {
  const { scheme: n, setScheme: l } = ce();
  return O(() => l(n === "dark" ? "light" : "dark"), [n, l]);
}
const te = 864e5, da = Date.UTC(622, 2, 22), ma = 365.2422, ne = (n) => n.toISOString().slice(0, 10), ae = (n) => /* @__PURE__ */ new Date(`${n}T00:00:00Z`), oe = () => ne(/* @__PURE__ */ new Date()), ua = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
  day: "numeric",
  month: "numeric",
  timeZone: "UTC",
  year: "numeric"
});
function Q(n, l) {
  const i = ae(n);
  if (l === "gregory")
    return { day: i.getUTCDate(), month: i.getUTCMonth() + 1, year: i.getUTCFullYear() };
  const a = ua.formatToParts(i), t = (s) => {
    var o;
    return Number(((o = a.find((c) => c.type === s)) == null ? void 0 : o.value) ?? "0");
  };
  return { day: t("day"), month: t("month"), year: t("year") };
}
const we = (n) => n.year * 1e4 + n.month * 100 + n.day;
function ie(n, l) {
  if (l === "gregory")
    return ne(new Date(Date.UTC(n.year, n.month - 1, n.day)));
  const i = Math.floor((n.year - 1) * ma) + (n.month <= 7 ? (n.month - 1) * 31 : 186 + (n.month - 7) * 30) + n.day - 1;
  let a = new Date(da + i * te);
  const t = we(n);
  for (let s = 0; s < 40; s += 1) {
    const o = Q(ne(a), "persian"), c = we(o);
    if (c === t) break;
    const r = (n.year - o.year) * 365 + (n.month - o.month) * 30 + (n.day - o.day);
    a = new Date(a.getTime() + (r === 0 ? c < t ? 1 : -1 : r) * te);
  }
  return ne(a);
}
function ha(n, l) {
  const i = Q(n, l);
  return ie({ ...i, day: 1 }, l);
}
function Ce(n, l, i) {
  const a = Q(n, i), t = a.year * 12 + (a.month - 1) + l, s = Math.floor(t / 12), o = t % 12 + 1, c = Be(s, o, i);
  return ie({ day: Math.min(a.day, c), month: o, year: s }, i);
}
function Be(n, l, i) {
  const a = ae(ie({ day: 1, month: l, year: n }, i)).getTime(), t = l === 12 ? 1 : l + 1, s = l === 12 ? n + 1 : n, o = ae(ie({ day: 1, month: t, year: s }, i)).getTime();
  return Math.round((o - a) / te);
}
const ue = (n, l) => ne(new Date(ae(n).getTime() + l * te)), _a = (n) => ae(n).getUTCDay();
function pa(n, l) {
  const i = n ?? "en";
  return i.includes("-u-ca-") || i.includes("-u-") ? i : `${i}-u-ca-${l}`;
}
const Ne = (n) => n != null && n.startsWith("fa") ? "persian" : "gregory", fa = (n) => n === "persian" ? 6 : 1, Se = /* @__PURE__ */ new Map();
function Na(n) {
  const l = n ?? "en", i = Se.get(l);
  if (i) return i;
  const a = new Intl.NumberFormat(l, { useGrouping: !1 }), t = Array.from({ length: 10 }, (s, o) => a.format(o));
  return Se.set(l, t), t;
}
function _e(n, l, i) {
  const a = Q(n, i), t = Na(l), s = (o, c = 1) => String(o).padStart(c, "0").replace(/\d/g, (r) => t[Number(r)]);
  return `${s(a.year)}/${s(a.month, 2)}/${s(a.day, 2)}`;
}
function ba(n, l) {
  const a = va(n).match(/\d+/g);
  if (!a || a.length < 3) return null;
  const [t, s, o] = a.map(Number);
  if (s < 1 || s > 12 || o < 1 || o > Be(t, s, l)) return null;
  const c = ie({ day: o, month: s, year: t }, l), r = Q(c, l);
  return r.year === t && r.month === s && r.day === o ? c : null;
}
function va(n) {
  let l = "";
  for (const i of n) {
    const a = i.codePointAt(0) ?? 0;
    a >= 1776 && a <= 1785 ? l += String.fromCodePoint(a - 1776 + 48) : a >= 1632 && a <= 1641 ? l += String.fromCodePoint(a - 1632 + 48) : l += i;
  }
  return l;
}
const Te = {
  next: "Next month",
  previous: "Previous month"
};
function Re({
  className: n,
  marked: l = [],
  max: i,
  min: a,
  month: t,
  onMonthChange: s,
  onSelect: o,
  system: c,
  value: r,
  weekStart: u
}) {
  const { locale: h } = ce(), _ = c ?? Ne(h), m = u ?? fa(_), p = oe(), f = pa(h, _), v = H(
    () => new Intl.DateTimeFormat(f, { month: "long", timeZone: "UTC", year: "numeric" }),
    [f]
  ), b = H(() => new Intl.NumberFormat(h), [h]), y = H(
    () => new Intl.DateTimeFormat(f, { timeZone: "UTC", weekday: "short" }),
    [f]
  ), k = ha(t, _), A = Q(k, _).month, z = H(() => {
    const C = (_a(k) - m + 7) % 7, P = ue(k, -C);
    return Array.from({ length: 42 }, (T, E) => {
      const x = ue(P, E), I = Q(x, _);
      return { date: x, day: I.day, outside: I.month !== A };
    });
  }, [k, A, _, m]), F = H(() => {
    const C = "2024-01-07";
    return Array.from({ length: 7 }, (P, T) => ({
      key: `${m}-${T}`,
      label: y.format(/* @__PURE__ */ new Date(`${ue(C, (m + T) % 7)}T00:00:00Z`))
    }));
  }, [m, y]);
  return /* @__PURE__ */ d("div", { className: N("nim-calendar", n), children: [
    /* @__PURE__ */ d("div", { className: "nim-calendar__header", children: [
      /* @__PURE__ */ e(
        R,
        {
          label: Te.previous,
          name: "chevron-back",
          onClick: () => s(Ce(k, -1, _)),
          size: "sm"
        }
      ),
      /* @__PURE__ */ e("span", { className: "nim-calendar__month", children: v.format(/* @__PURE__ */ new Date(`${k}T00:00:00Z`)) }),
      /* @__PURE__ */ e(
        R,
        {
          label: Te.next,
          name: "chevron-forward",
          onClick: () => s(Ce(k, 1, _)),
          size: "sm"
        }
      )
    ] }),
    /* @__PURE__ */ d("div", { className: "nim-calendar__grid", role: "grid", children: [
      F.map((C) => /* @__PURE__ */ e("span", { className: "nim-calendar__weekday", children: C.label }, C.key)),
      z.map((C) => /* @__PURE__ */ e(
        "button",
        {
          "aria-selected": C.date === r,
          className: N(
            "nim-calendar__day",
            C.outside && "nim-calendar__day--outside",
            C.date === p && "nim-calendar__day--today",
            l.includes(C.date) && "nim-calendar__day--marked"
          ),
          disabled: a !== void 0 && C.date < a || i !== void 0 && C.date > i,
          onClick: () => o(C.date),
          role: "gridcell",
          type: "button",
          children: b.format(C.day)
        },
        C.date
      ))
    ] })
  ] });
}
function Fe({
  calendar: n,
  describedBy: l,
  id: i,
  invalid: a,
  locale: t,
  onChange: s,
  value: o
}) {
  const [c, r] = S(null);
  if (n === "gregory")
    return /* @__PURE__ */ e(
      "input",
      {
        "aria-describedby": l,
        "aria-invalid": a ? !0 : void 0,
        className: "nim-input",
        id: i,
        onChange: (h) => s(h.target.value),
        type: "date",
        value: o
      }
    );
  const u = c ?? (o ? _e(o, t, n) : "");
  return /* @__PURE__ */ e(
    "input",
    {
      "aria-describedby": l,
      "aria-invalid": a ? !0 : void 0,
      className: "nim-input",
      dir: "ltr",
      id: i,
      inputMode: "numeric",
      onBlur: () => r(null),
      onChange: (h) => {
        r(h.target.value);
        const _ = ba(h.target.value, n);
        _ ? s(_) : h.target.value.trim() === "" && s("");
      },
      placeholder: _e(oe(), t, n),
      type: "text",
      value: u
    }
  );
}
function ki({
  error: n,
  hint: l,
  id: i,
  label: a,
  onChange: t,
  required: s,
  value: o,
  ...c
}) {
  const { locale: r } = ce(), u = c.system ?? Ne(r), [h, _] = S(o || oe());
  return /* @__PURE__ */ e(X, { error: n, hint: l, id: i, label: a, required: s, children: ({ control: m, describedBy: p }) => /* @__PURE__ */ d("div", { className: "nim-stack nim-stack--tight", children: [
    /* @__PURE__ */ e(
      Fe,
      {
        calendar: u,
        describedBy: p,
        id: m,
        invalid: !!n,
        locale: r,
        onChange: (f) => {
          t(f), f && _(f);
        },
        value: o
      }
    ),
    /* @__PURE__ */ e(
      Re,
      {
        ...c,
        month: h,
        onMonthChange: _,
        onSelect: (f) => {
          t(f), _(f);
        },
        system: u,
        value: o
      }
    )
  ] }) });
}
function wi({
  error: n,
  hint: l,
  id: i,
  label: a,
  labels: t,
  onChange: s,
  required: o,
  showEquivalent: c,
  value: r,
  ...u
}) {
  const { locale: h } = ce(), _ = u.system ?? Ne(h), [m, p] = S(!1), [f, v] = S(r || oe()), b = L(null), y = { clear: "Clear date", open: "Open calendar", ...t }, k = c ?? _ === "persian", A = _ === "persian" ? "gregory" : "persian";
  return /* @__PURE__ */ e(X, { error: n, hint: l, id: i, label: a, required: o, children: ({ control: z, describedBy: F }) => /* @__PURE__ */ d("div", { className: "nim-date-picker", children: [
    /* @__PURE__ */ d("div", { className: "nim-date-picker__group", children: [
      /* @__PURE__ */ e(
        Fe,
        {
          calendar: _,
          describedBy: F,
          id: z,
          invalid: !!n,
          locale: h,
          onChange: (C) => {
            s(C), C && v(C);
          },
          value: r
        }
      ),
      r ? /* @__PURE__ */ e(
        R,
        {
          label: y.clear,
          name: "close",
          onClick: () => s(""),
          size: "sm"
        }
      ) : null,
      /* @__PURE__ */ e(
        R,
        {
          "aria-expanded": m,
          label: y.open,
          name: "calendar",
          onClick: () => p((C) => !C),
          ref: b,
          size: "sm"
        }
      )
    ] }),
    k && r ? /* @__PURE__ */ d("p", { className: "nim-date-picker__equivalent", children: [
      /* @__PURE__ */ e(w, { name: "calendar", size: "xs" }),
      /* @__PURE__ */ e("span", { dir: A === "gregory" ? "ltr" : void 0, children: _e(r, h, A) })
    ] }) : null,
    /* @__PURE__ */ e(
      oa,
      {
        label: a ?? y.open,
        onClose: () => p(!1),
        open: m,
        triggerRef: b,
        children: /* @__PURE__ */ e(
          Re,
          {
            ...u,
            month: f,
            onMonthChange: v,
            onSelect: (C) => {
              s(C), v(C), p(!1);
            },
            system: _,
            value: r
          }
        )
      }
    )
  ] }) });
}
function Ci({
  children: n,
  className: l,
  closeLabel: i = "Close",
  description: a,
  footer: t,
  onClose: s,
  open: o,
  title: c
}) {
  const r = L(null);
  return Z(() => {
    const u = r.current;
    u && (o && !u.open && u.showModal(), !o && u.open && u.close());
  }, [o]), Z(() => {
    const u = r.current;
    if (!u) return;
    const h = () => s();
    return u.addEventListener("close", h), () => u.removeEventListener("close", h);
  }, [s]), /* @__PURE__ */ d(
    "dialog",
    {
      className: N("nim-dialog", l),
      onClick: (u) => {
        u.target === r.current && s();
      },
      ref: r,
      children: [
        /* @__PURE__ */ d("div", { className: "nim-dialog__header", children: [
          /* @__PURE__ */ d("div", { children: [
            /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", children: c }),
            a ? /* @__PURE__ */ e("p", { className: "nim-caption", children: a }) : null
          ] }),
          /* @__PURE__ */ e(R, { label: i, name: "close", onClick: s, size: "sm" })
        ] }),
        /* @__PURE__ */ e("div", { className: "nim-dialog__body", children: n }),
        t ? /* @__PURE__ */ e("div", { className: "nim-dialog__footer", children: t }) : null
      ]
    }
  );
}
function Si({ actions: n, className: l, description: i, icon: a = "search", title: t, ...s }) {
  return /* @__PURE__ */ d("div", { className: N("nim-empty", l), ...s, children: [
    /* @__PURE__ */ e("span", { className: "nim-empty__icon", children: /* @__PURE__ */ e(w, { name: a, size: "md" }) }),
    /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", children: t }),
    i ? /* @__PURE__ */ e("p", { className: "nim-body nim-body--sm nim-empty__body", children: i }) : null,
    n ? /* @__PURE__ */ e("div", { className: "nim-empty__actions", children: n }) : null
  ] });
}
function Ti({
  className: n,
  detail: l,
  label: i,
  percent: a,
  tone: t = "accent",
  value: s,
  ...o
}) {
  const c = typeof a == "number", r = Math.min(100, Math.max(0, a ?? 0)), u = typeof i == "string" ? i : void 0;
  return /* @__PURE__ */ d("div", { className: N("nim-resource-meter", n), "data-tone": t, ...o, children: [
    /* @__PURE__ */ d("div", { className: "nim-resource-meter__head", children: [
      /* @__PURE__ */ e("span", { className: "nim-resource-meter__label", children: i }),
      /* @__PURE__ */ e("span", { className: "nim-resource-meter__value", children: s })
    ] }),
    c ? /* @__PURE__ */ e(
      "div",
      {
        "aria-label": u,
        "aria-valuemax": 100,
        "aria-valuemin": 0,
        "aria-valuenow": r,
        className: "nim-resource-meter__track",
        role: "meter",
        children: /* @__PURE__ */ e("span", { className: "nim-resource-meter__fill", style: { inlineSize: `${r}%` } })
      }
    ) : null,
    l ? /* @__PURE__ */ e("span", { className: "nim-resource-meter__detail", children: l }) : null
  ] });
}
function xi({
  accept: n,
  caption: l,
  className: i,
  disabled: a = !1,
  error: t,
  label: s,
  multiple: o = !1,
  onFiles: c,
  prompt: r
}) {
  const u = L(0), [h, _] = S(!1), m = (p) => {
    p.preventDefault(), p.stopPropagation();
  };
  return /* @__PURE__ */ d("div", { className: N("nim-field", t && "nim-field--invalid", i), children: [
    /* @__PURE__ */ d(
      "label",
      {
        className: "nim-file-drop",
        "data-over": h || void 0,
        "data-disabled": a || void 0,
        onDragEnter: (p) => {
          m(p), u.current += 1, a || _(!0);
        },
        onDragLeave: (p) => {
          m(p), u.current -= 1, u.current <= 0 && _(!1);
        },
        onDragOver: m,
        onDrop: (p) => {
          if (m(p), u.current = 0, _(!1), a) return;
          const f = Array.from(p.dataTransfer.files);
          f.length > 0 && c(o ? f : f.slice(0, 1));
        },
        children: [
          /* @__PURE__ */ e(
            "input",
            {
              accept: n,
              className: "nim-choice__input",
              disabled: a,
              multiple: o,
              onChange: (p) => {
                const f = Array.from(p.target.files ?? []);
                f.length > 0 && c(f), p.target.value = "";
              },
              type: "file"
            }
          ),
          /* @__PURE__ */ e(w, { className: "nim-file-drop__icon", name: "upload", size: "lg" }),
          /* @__PURE__ */ e("span", { className: "nim-file-drop__label", children: s }),
          r ? /* @__PURE__ */ e("span", { className: "nim-file-drop__prompt", children: r }) : null,
          l ? /* @__PURE__ */ e("span", { className: "nim-file-drop__caption", children: l }) : null
        ]
      }
    ),
    t ? /* @__PURE__ */ e("p", { className: "nim-field__error", children: t }) : null
  ] });
}
function Ai({ children: n, className: l, ...i }) {
  return /* @__PURE__ */ e("div", { className: N("nim-app-frame", l), ...i, children: n });
}
function Di({
  children: n,
  className: l,
  gap: i = "md",
  ...a
}) {
  return /* @__PURE__ */ e("div", { className: N("nim-stack", i !== "md" && `nim-stack--${i}`, l), ...a, children: n });
}
function Ei({
  children: n,
  className: l,
  gap: i = "md",
  wrap: a = !0,
  ...t
}) {
  return /* @__PURE__ */ e(
    "div",
    {
      className: N("nim-inline", i !== "md" && `nim-inline--${i}`, !a && "nim-inline--nowrap", l),
      ...t,
      children: n
    }
  );
}
function ga({ children: n, className: l, plain: i = !1, ...a }) {
  return /* @__PURE__ */ e("div", { className: N("nim-list", i && "nim-list--plain", l), ...a, children: n });
}
function ya({
  className: n,
  href: l,
  leading: i,
  onClick: a,
  subtitle: t,
  title: s,
  trailing: o,
  ...c
}) {
  const r = !!(l || a), u = /* @__PURE__ */ d(Y, { children: [
    i ? /* @__PURE__ */ e("span", { className: "nim-list-row__leading", children: i }) : null,
    /* @__PURE__ */ d("span", { className: "nim-list-row__content", children: [
      /* @__PURE__ */ e("span", { className: "nim-list-row__title", children: s }),
      t ? /* @__PURE__ */ e("span", { className: "nim-list-row__subtitle", children: t }) : null
    ] }),
    o ? /* @__PURE__ */ e("span", { className: "nim-list-row__trailing", children: o }) : null,
    r && !o ? /* @__PURE__ */ e(w, { className: "nim-list-row__chevron", name: "chevron-forward", size: "sm" }) : null
  ] }), h = N("nim-list-row", r && "nim-list-row--interactive", n);
  return l ? /* @__PURE__ */ e("a", { className: h, href: l, ...c, children: u }) : a ? /* @__PURE__ */ e("button", { className: h, onClick: a, type: "button", ...c, children: u }) : /* @__PURE__ */ e("div", { className: h, ...c, children: u });
}
const ka = {
  back: "Back",
  dot: (n) => `Slide ${n + 1}`
};
function Mi({
  brand: n,
  className: l,
  finishLabel: i,
  footnote: a,
  labels: t,
  nextLabel: s,
  onDone: o,
  onSkip: c,
  onStep: r,
  skipLabel: u,
  slides: h
}) {
  var y;
  const [_, m] = S(0), p = { ...ka, ...t }, f = h[Math.min(_, h.length - 1)], v = _ === h.length - 1, b = O(
    (k) => {
      m(k), r == null || r(k);
    },
    [r]
  );
  return /* @__PURE__ */ d("section", { className: N("nim-onboarding", l), children: [
    /* @__PURE__ */ d("header", { className: "nim-onboarding__bar", children: [
      /* @__PURE__ */ e("span", { className: "nim-onboarding__brand", children: n }),
      u ? /* @__PURE__ */ e(
        J,
        {
          iconEnd: "chevron-forward",
          onClick: c ?? o,
          size: "sm",
          variant: "ghost",
          children: u
        }
      ) : null
    ] }),
    /* @__PURE__ */ d("div", { "aria-live": "polite", className: "nim-onboarding__stage", children: [
      f.art ? /* @__PURE__ */ e("div", { className: "nim-onboarding__art", children: f.art }) : null,
      f.proof ? /* @__PURE__ */ d("div", { className: "nim-onboarding__proof", children: [
        f.proof.icon ? /* @__PURE__ */ e("span", { className: "nim-onboarding__proof-icon", children: f.proof.icon }) : null,
        /* @__PURE__ */ d("span", { className: "nim-onboarding__proof-text", children: [
          /* @__PURE__ */ e("span", { className: "nim-onboarding__proof-title", children: f.proof.title }),
          (y = f.proof.points) != null && y.length ? /* @__PURE__ */ e("span", { className: "nim-onboarding__proof-points", children: f.proof.points.join(" · ") }) : null
        ] })
      ] }) : null
    ] }),
    /* @__PURE__ */ d("div", { className: "nim-onboarding__copy", children: [
      f.label ? /* @__PURE__ */ e("span", { className: "nim-onboarding__chip", children: f.label }) : null,
      /* @__PURE__ */ e("h1", { className: "nim-onboarding__title", children: f.title }),
      f.body ? /* @__PURE__ */ e("p", { className: "nim-onboarding__body", children: f.body }) : null
    ] }),
    /* @__PURE__ */ d("footer", { className: "nim-onboarding__controls", children: [
      /* @__PURE__ */ e("div", { className: "nim-onboarding__dots", children: h.map((k, A) => /* @__PURE__ */ e(
        "button",
        {
          "aria-current": A === _ ? "step" : void 0,
          "aria-label": p.dot(A),
          className: "nim-onboarding__dot",
          onClick: () => b(A),
          type: "button"
        },
        k.id
      )) }),
      /* @__PURE__ */ d("div", { className: "nim-onboarding__cta", children: [
        _ > 0 ? /* @__PURE__ */ e(
          R,
          {
            label: p.back,
            name: "chevron-back",
            onClick: () => b(_ - 1),
            size: "lg",
            variant: "outline"
          }
        ) : null,
        /* @__PURE__ */ e(
          J,
          {
            fullWidth: !0,
            iconEnd: v ? "arrow-forward" : void 0,
            onClick: () => v ? o() : b(_ + 1),
            size: "lg",
            variant: "accent",
            children: v ? i : s
          }
        )
      ] }),
      a ? /* @__PURE__ */ e("p", { className: "nim-onboarding__footnote", children: a }) : null
    ] })
  ] });
}
const wa = "AD:376 AE:971 AF:93 AG:1268 AI:1264 AL:355 AM:374 AO:244 AQ:672 AR:54 AS:1684 AT:43 AU:61 AW:297 AX:358 AZ:994 BA:387 BB:1246 BD:880 BE:32 BF:226 BG:359 BH:973 BI:257 BJ:229 BL:590 BM:1441 BN:673 BO:591 BQ:599 BR:55 BS:1242 BT:975 BW:267 BY:375 BZ:501 CA:1 CC:61 CD:243 CF:236 CG:242 CH:41 CI:225 CK:682 CL:56 CM:237 CN:86 CO:57 CR:506 CU:53 CV:238 CW:599 CX:61 CY:357 CZ:420 DE:49 DJ:253 DK:45 DM:1767 DO:1809 DZ:213 EC:593 EE:372 EG:20 EH:212 ER:291 ES:34 ET:251 FI:358 FJ:679 FK:500 FM:691 FO:298 FR:33 GA:241 GB:44 GD:1473 GE:995 GF:594 GG:44 GH:233 GI:350 GL:299 GM:220 GN:224 GP:590 GQ:240 GR:30 GT:502 GU:1671 GW:245 GY:592 HK:852 HN:504 HR:385 HT:509 HU:36 ID:62 IE:353 IL:972 IM:44 IN:91 IO:246 IQ:964 IR:98 IS:354 IT:39 JE:44 JM:1876 JO:962 JP:81 KE:254 KG:996 KH:855 KI:686 KM:269 KN:1869 KP:850 KR:82 KW:965 KY:1345 KZ:7 LA:856 LB:961 LC:1758 LI:423 LK:94 LR:231 LS:266 LT:370 LU:352 LV:371 LY:218 MA:212 MC:377 MD:373 ME:382 MF:590 MG:261 MH:692 MK:389 ML:223 MM:95 MN:976 MO:853 MP:1670 MQ:596 MR:222 MS:1664 MT:356 MU:230 MV:960 MW:265 MX:52 MY:60 MZ:258 NA:264 NC:687 NE:227 NF:672 NG:234 NI:505 NL:31 NO:47 NP:977 NR:674 NU:683 NZ:64 OM:968 PA:507 PE:51 PF:689 PG:675 PH:63 PK:92 PL:48 PM:508 PR:1787 PS:970 PT:351 PW:680 PY:595 QA:974 RE:262 RO:40 RS:381 RU:7 RW:250 SA:966 SB:677 SC:248 SD:249 SE:46 SG:65 SH:290 SI:386 SJ:47 SK:421 SL:232 SM:378 SN:221 SO:252 SR:597 SS:211 ST:239 SV:503 SX:1721 SY:963 SZ:268 TC:1649 TD:235 TG:228 TH:66 TJ:992 TK:690 TL:670 TM:993 TN:216 TO:676 TR:90 TT:1868 TV:688 TW:886 TZ:255 UA:380 UG:256 US:1 UY:598 UZ:998 VA:39 VC:1784 VE:58 VG:1284 VI:1340 VN:84 VU:678 WF:681 WS:685 YE:967 YT:262 ZA:27 ZM:260 ZW:263";
function Ca(n) {
  return String.fromCodePoint(...[...n].map((l) => 127462 + l.charCodeAt(0) - 65));
}
const se = wa.split(" ").map((n) => {
  const [l, i] = n.split(":");
  return { dial: i, flag: Ca(l), iso2: l };
}), Sa = new Map(se.map((n) => [n.iso2, n]));
function Oe(n) {
  return Sa.get(n.toUpperCase());
}
function Li(n) {
  const l = n.replace(/\D/g, "");
  let i;
  for (const a of se)
    l.startsWith(a.dial) && (!i || a.dial.length > i.dial.length) && (i = a);
  return i;
}
const xe = /* @__PURE__ */ new Map();
function Ta(n) {
  const l = xe.get(n);
  if (l) return l;
  let i;
  try {
    const a = new Intl.DisplayNames([n], { type: "region" });
    i = (t) => a.of(t) ?? t;
  } catch {
    i = (a) => a;
  }
  return xe.set(n, i), i;
}
function le(n) {
  let l = "";
  for (const i of n) {
    const a = i.codePointAt(0) ?? 0;
    a >= 1776 && a <= 1785 ? l += String.fromCodePoint(a - 1776 + 48) : a >= 1632 && a <= 1641 ? l += String.fromCodePoint(a - 1632 + 48) : i >= "0" && i <= "9" && (l += i);
  }
  return l;
}
function xa({
  autoFocus: n = !1,
  className: l,
  digitLabel: i,
  error: a,
  label: t,
  length: s = 5,
  onChange: o,
  onComplete: c,
  value: r
}) {
  const u = L(null), h = r.slice(0, s).split(""), _ = O((b) => {
    var k, A;
    const y = (k = u.current) == null ? void 0 : k.querySelectorAll("input");
    (A = y == null ? void 0 : y[Math.max(0, Math.min(b, y.length - 1))]) == null || A.focus();
  }, []);
  Z(() => {
    n && _(0);
  }, [n, _]);
  const m = O(
    (b, y) => {
      const k = b.slice(0, s);
      o(k), k.length === s ? c == null || c(k) : _(y);
    },
    [_, s, o, c]
  ), p = O(
    (b, y) => {
      const k = le(y);
      if (!k) return;
      const A = (r.slice(0, b) + k).slice(0, s);
      m(A, A.length);
    },
    [m, s, r]
  ), f = O(
    (b, y) => {
      if (y.key === "Backspace") {
        y.preventDefault();
        const k = r[b] ? b : b - 1;
        if (k < 0) return;
        o(r.slice(0, k) + r.slice(k + 1)), _(k);
      } else y.key === "ArrowLeft" ? _(b - 1) : y.key === "ArrowRight" && _(b + 1);
    },
    [_, o, r]
  ), v = O(
    (b) => {
      const y = le(b.clipboardData.getData("text"));
      y && (b.preventDefault(), m(y.slice(0, s), y.length));
    },
    [m, s]
  );
  return /* @__PURE__ */ d("div", { className: N("nim-otp", a && "nim-otp--invalid", l), children: [
    /* @__PURE__ */ e(
      "div",
      {
        "aria-label": t,
        className: "nim-otp__boxes",
        dir: "ltr",
        onPaste: v,
        ref: u,
        role: "group",
        children: Array.from({ length: s }, (b, y) => /* @__PURE__ */ e(
          "input",
          {
            "aria-invalid": a ? !0 : void 0,
            "aria-label": i ? i(y) : `${t} ${y + 1}`,
            autoComplete: y === 0 ? "one-time-code" : "off",
            className: "nim-otp__box",
            "data-filled": h[y] ? "true" : void 0,
            enterKeyHint: "done",
            inputMode: "numeric",
            onChange: (k) => p(y, k.target.value),
            onFocus: (k) => k.currentTarget.select(),
            onKeyDown: (k) => f(y, k),
            type: "text",
            value: h[y] ?? ""
          },
          y
        ))
      }
    ),
    a ? /* @__PURE__ */ e("p", { className: "nim-otp__error", role: "alert", children: a }) : null
  ] });
}
const Aa = (n, l) => {
  if (l <= 7) return Array.from({ length: l }, (t, s) => s + 1);
  const i = /* @__PURE__ */ new Set([1, l, n, n - 1, n + 1]);
  n <= 3 && [2, 3, 4].forEach((t) => i.add(t)), n >= l - 2 && [l - 3, l - 2, l - 1].forEach((t) => i.add(t));
  const a = [...i].filter((t) => t >= 1 && t <= l).sort((t, s) => t - s);
  return a.flatMap((t, s) => s > 0 && t - a[s - 1] > 1 ? ["gap", t] : [t]);
};
function zi({
  className: n,
  label: l = "Pagination",
  nextLabel: i = "Next page",
  onChange: a,
  page: t,
  pageCount: s,
  previousLabel: o = "Previous page",
  summary: c
}) {
  return /* @__PURE__ */ d("nav", { "aria-label": l, className: N("nim-pagination", n), children: [
    c ? /* @__PURE__ */ e("p", { className: "nim-pagination__summary", children: c }) : /* @__PURE__ */ e("span", {}),
    /* @__PURE__ */ d("div", { className: "nim-pagination__list", children: [
      /* @__PURE__ */ e(
        "button",
        {
          "aria-label": o,
          className: "nim-pagination__item",
          disabled: t <= 1,
          onClick: () => a(t - 1),
          type: "button",
          children: /* @__PURE__ */ e(w, { name: "chevron-back", size: "sm" })
        }
      ),
      Aa(t, s).map(
        (r, u) => r === "gap" ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-pagination__ellipsis", children: "…" }, `gap-${u}`) : /* @__PURE__ */ e(
          "button",
          {
            "aria-current": r === t ? "page" : void 0,
            className: "nim-pagination__item",
            onClick: () => a(r),
            type: "button",
            children: r
          },
          r
        )
      ),
      /* @__PURE__ */ e(
        "button",
        {
          "aria-label": i,
          className: "nim-pagination__item",
          disabled: t >= s,
          onClick: () => a(t + 1),
          type: "button",
          children: /* @__PURE__ */ e(w, { name: "chevron-forward", size: "sm" })
        }
      )
    ] })
  ] });
}
const Da = {
  hide: "Hide password",
  show: "Show password",
  strength: (n) => `Password strength: ${n}`
}, Ae = ["weak", "fair", "good", "strong"];
function Ea({
  className: n,
  error: l,
  hint: i,
  id: a,
  label: t,
  labels: s,
  required: o,
  strength: c,
  ...r
}) {
  const [u, h] = S(!1), _ = { ...Da, ...s };
  return /* @__PURE__ */ e(X, { error: l, hint: i, id: a, label: t, required: o, children: ({ control: m, describedBy: p }) => /* @__PURE__ */ d(Y, { children: [
    /* @__PURE__ */ d("div", { className: "nim-input-shell nim-input-shell--has-end", children: [
      /* @__PURE__ */ e(
        "input",
        {
          "aria-describedby": p,
          "aria-invalid": l ? !0 : void 0,
          autoComplete: r.autoComplete ?? "current-password",
          className: N("nim-input", n),
          id: m,
          required: o,
          ...r,
          type: u ? "text" : "password"
        }
      ),
      /* @__PURE__ */ e(
        "button",
        {
          "aria-controls": m,
          "aria-label": u ? _.hide : _.show,
          "aria-pressed": u,
          className: "nim-password__toggle",
          onClick: () => h((f) => !f),
          type: "button",
          children: /* @__PURE__ */ e(w, { name: "eye", size: "sm" })
        }
      )
    ] }),
    c ? /* @__PURE__ */ e(
      "div",
      {
        "aria-label": _.strength(c),
        className: "nim-password__meter",
        "data-level": c,
        role: "img",
        children: Ae.map((f, v) => /* @__PURE__ */ e(
          "span",
          {
            className: "nim-password__step",
            "data-on": v <= Ae.indexOf(c) ? "true" : void 0
          },
          f
        ))
      }
    ) : null
  ] }) });
}
function $i(n) {
  if (n.length < 8) return "weak";
  const l = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((i) => i.test(n)).length;
  return n.length >= 14 && l >= 3 ? "strong" : n.length >= 10 && l >= 2 ? "good" : "fair";
}
const Ma = {
  noMatch: "No country matches",
  pickCountry: "Country code",
  search: "Search countries"
};
function La({
  className: n,
  country: l,
  error: i,
  hint: a,
  id: t,
  label: s,
  labels: o,
  locale: c,
  onChange: r,
  onCountryChange: u,
  onSubmit: h,
  placeholder: _,
  priority: m = [],
  required: p,
  value: f
}) {
  const v = q(), b = t ?? `nim-${v}`, y = a ? `${b}-hint` : void 0, k = i ? `${b}-error` : void 0, A = { ...Ma, ...o }, [z, F] = S(!1), [C, P] = S(""), T = L(null), E = L(null), x = L(null), I = c ?? (typeof document > "u" ? "en" : document.documentElement.lang || "en"), B = H(() => Ta(I), [I]), K = Oe(l) ?? se[0], j = H(() => {
    const g = new Intl.Collator(I), D = se.map(($) => ({ ...$, name: B($.iso2) })), M = ($) => {
      const U = m.indexOf($);
      return U === -1 ? m.length : U;
    };
    return D.sort(
      ($, U) => M($.iso2) - M(U.iso2) || g.compare($.name, U.name)
    );
  }, [B, m, I]), W = H(() => {
    const g = C.trim().toLocaleLowerCase(I);
    if (!g) return j;
    const D = le(g);
    return j.filter(
      (M) => M.name.toLocaleLowerCase(I).includes(g) || M.iso2.toLowerCase().includes(g) || (D ? M.dial.startsWith(D) : !1)
    );
  }, [j, C, I]);
  Z(() => {
    var M;
    if (!z) return;
    (M = x.current) == null || M.focus();
    const g = ($) => {
      var U;
      (U = T.current) != null && U.contains($.target) || F(!1);
    }, D = ($) => {
      var U;
      $.key === "Escape" && (F(!1), (U = E.current) == null || U.focus());
    };
    return document.addEventListener("mousedown", g), document.addEventListener("keydown", D), () => {
      document.removeEventListener("mousedown", g), document.removeEventListener("keydown", D);
    };
  }, [z]);
  const V = (g) => {
    var D;
    u(g), F(!1), P(""), (D = E.current) == null || D.focus();
  };
  return /* @__PURE__ */ d("div", { className: N("nim-field", i && "nim-field--invalid", n), children: [
    s ? /* @__PURE__ */ d("label", { className: "nim-field__label", htmlFor: b, children: [
      s,
      p ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-field__required", children: "*" }) : null
    ] }) : null,
    /* @__PURE__ */ d("div", { className: "nim-phone", ref: T, children: [
      /* @__PURE__ */ d("div", { className: "nim-phone__shell", dir: "ltr", children: [
        /* @__PURE__ */ d(
          "button",
          {
            "aria-expanded": z,
            "aria-haspopup": "listbox",
            "aria-label": `${A.pickCountry}: ${B(K.iso2)} +${K.dial}`,
            className: "nim-phone__country",
            onClick: () => F((g) => !g),
            ref: E,
            type: "button",
            children: [
              /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-phone__flag", children: K.flag }),
              /* @__PURE__ */ d("span", { className: "nim-phone__dial", children: [
                "+",
                K.dial
              ] }),
              /* @__PURE__ */ e(w, { className: "nim-phone__caret", name: "chevron-down", size: "xs" })
            ]
          }
        ),
        /* @__PURE__ */ e(
          "input",
          {
            "aria-describedby": [k, y].filter(Boolean).join(" ") || void 0,
            "aria-invalid": i ? !0 : void 0,
            autoComplete: "tel-national",
            className: "nim-phone__input",
            enterKeyHint: "go",
            id: b,
            inputMode: "tel",
            onChange: (g) => r(le(g.target.value)),
            onKeyDown: (g) => {
              g.key === "Enter" && (h == null || h());
            },
            placeholder: _,
            required: p,
            type: "tel",
            value: f
          }
        )
      ] }),
      z ? /* @__PURE__ */ d("div", { className: "nim-phone__picker", children: [
        /* @__PURE__ */ d("div", { className: "nim-phone__search", children: [
          /* @__PURE__ */ e(w, { name: "search", size: "sm" }),
          /* @__PURE__ */ e(
            "input",
            {
              "aria-label": A.search,
              className: "nim-phone__search-input",
              onChange: (g) => P(g.target.value),
              placeholder: A.search,
              ref: x,
              type: "search",
              value: C
            }
          )
        ] }),
        /* @__PURE__ */ d("ul", { className: "nim-phone__list", role: "listbox", children: [
          W.map((g) => /* @__PURE__ */ e("li", { children: /* @__PURE__ */ d(
            "button",
            {
              "aria-selected": g.iso2 === K.iso2,
              className: "nim-phone__option",
              onClick: () => V(g.iso2),
              role: "option",
              type: "button",
              children: [
                /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-phone__flag", children: g.flag }),
                /* @__PURE__ */ e("span", { className: "nim-phone__name", children: g.name }),
                /* @__PURE__ */ d("span", { className: "nim-phone__option-dial", dir: "ltr", children: [
                  "+",
                  g.dial
                ] })
              ]
            }
          ) }, g.iso2)),
          W.length === 0 ? /* @__PURE__ */ e("li", { className: "nim-phone__empty", children: A.noMatch }) : null
        ] })
      ] }) : null
    ] }),
    i ? /* @__PURE__ */ e("p", { className: "nim-field__error", id: k, children: i }) : null,
    a && !i ? /* @__PURE__ */ e("p", { className: "nim-field__hint", id: y, children: a }) : null
  ] });
}
function za(n, l) {
  var a;
  return `+${((a = Oe(n)) == null ? void 0 : a.dial) ?? ""}${le(l).replace(/^0+/, "")}`;
}
const $a = {
  excluded: "minus",
  included: "check",
  pending: "clock"
};
function Ia({
  badge: n,
  className: l,
  features: i = [],
  icon: a,
  name: t,
  onSelect: s,
  price: o,
  priceCaption: c,
  secondary: r,
  selected: u = !1,
  tagline: h
}) {
  const _ = /* @__PURE__ */ d(Y, { children: [
    /* @__PURE__ */ d("div", { className: "nim-plan__top", children: [
      a ? /* @__PURE__ */ e("span", { className: "nim-plan__icon", children: /* @__PURE__ */ e(w, { name: a, size: "md" }) }) : null,
      /* @__PURE__ */ d("div", { className: "nim-plan__heading", children: [
        /* @__PURE__ */ e("span", { className: "nim-plan__name", children: t }),
        h ? /* @__PURE__ */ e("span", { className: "nim-plan__tagline", children: h }) : null
      ] }),
      n ? /* @__PURE__ */ e("span", { className: "nim-plan__badge", children: n }) : null,
      s ? /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-plan__radio", children: u ? /* @__PURE__ */ e(w, { name: "check", size: "xs" }) : null }) : null
    ] }),
    /* @__PURE__ */ d("div", { className: "nim-plan__price-box", children: [
      /* @__PURE__ */ d("div", { children: [
        c ? /* @__PURE__ */ e("span", { className: "nim-plan__price-caption", children: c }) : null,
        /* @__PURE__ */ e("strong", { className: "nim-plan__price", children: o })
      ] }),
      r ? /* @__PURE__ */ d("div", { className: "nim-plan__secondary", children: [
        /* @__PURE__ */ e("span", { className: "nim-plan__price-caption", children: r.caption }),
        /* @__PURE__ */ e("strong", { className: "nim-plan__secondary-value", children: r.value })
      ] }) : null
    ] }),
    i.length ? /* @__PURE__ */ e("ul", { className: "nim-plan__features", children: i.map((p, f) => {
      const v = p.state ?? "included";
      return /* @__PURE__ */ d("li", { className: "nim-plan__feature", "data-state": v, children: [
        /* @__PURE__ */ e(w, { name: $a[v], size: "xs" }),
        /* @__PURE__ */ e("span", { className: "nim-plan__feature-label", children: p.label }),
        p.note ? /* @__PURE__ */ e("span", { className: "nim-plan__feature-note", children: p.note }) : null
      ] }, f);
    }) }) : null
  ] }), m = N("nim-plan", u && "nim-plan--selected", l);
  return s ? /* @__PURE__ */ e("button", { "aria-pressed": u, className: m, onClick: s, type: "button", children: _ }) : /* @__PURE__ */ e("article", { className: m, children: _ });
}
function Pa({
  className: n,
  fullWidth: l = !1,
  label: i,
  onChange: a,
  options: t,
  value: s,
  ...o
}) {
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": i,
      className: N("nim-segmented", l && "nim-segmented--full", n),
      role: "tablist",
      ...o,
      children: t.map((c) => /* @__PURE__ */ e(
        "button",
        {
          "aria-selected": c.value === s,
          className: "nim-segmented__option",
          disabled: c.disabled,
          onClick: () => a(c.value),
          role: "tab",
          type: "button",
          children: c.label
        },
        c.value
      ))
    }
  );
}
const Ba = {
  cycle: "Billing period",
  monthly: "Per month",
  price: "This package"
};
function Ii({
  className: n,
  cycle: l,
  cycles: i = [],
  defaultCycle: a,
  defaultPlan: t,
  labels: s,
  note: o,
  onCycleChange: c,
  onPlanChange: r,
  onSubmit: u,
  plan: h,
  plans: _,
  submitLabel: m
}) {
  var P, T;
  const p = { ...Ba, ...s }, [f, v] = S(a ?? ((P = i[0]) == null ? void 0 : P.id) ?? ""), [b, y] = S(t ?? ((T = _[0]) == null ? void 0 : T.id) ?? ""), k = l ?? f, A = h ?? b, z = (E) => {
    y(E), r == null || r(E);
  }, F = (E) => {
    v(E), c == null || c(E);
  }, C = i.find((E) => E.id === k);
  return /* @__PURE__ */ d("section", { className: N("nim-plan-picker", n), children: [
    i.length > 1 ? /* @__PURE__ */ d("div", { className: "nim-plan-picker__cycles", children: [
      /* @__PURE__ */ e(
        Pa,
        {
          fullWidth: !0,
          label: p.cycle,
          onChange: F,
          options: i.map((E) => ({ label: E.label, value: E.id })),
          value: k
        }
      ),
      C != null && C.note ? /* @__PURE__ */ e("p", { className: "nim-plan-picker__save", children: C.note }) : null
    ] }) : null,
    /* @__PURE__ */ e("div", { className: "nim-plan-picker__plans", children: _.map(({ id: E, prices: x, ...I }) => {
      const B = x[k] ?? Object.values(x)[0];
      return /* @__PURE__ */ We(
        Ia,
        {
          ...I,
          key: E,
          onSelect: () => z(E),
          price: (B == null ? void 0 : B.price) ?? "",
          priceCaption: p.price,
          secondary: (B == null ? void 0 : B.monthly) === void 0 ? void 0 : { caption: p.monthly, value: B.monthly },
          selected: E === A
        }
      );
    }) }),
    m ? /* @__PURE__ */ d("div", { className: "nim-plan-picker__foot", children: [
      /* @__PURE__ */ e(
        J,
        {
          fullWidth: !0,
          onClick: () => u == null ? void 0 : u(A, k),
          size: "lg",
          variant: "accent",
          children: m
        }
      ),
      o ? /* @__PURE__ */ e("p", { className: "nim-plan-picker__note", children: o }) : null
    ] }) : null
  ] });
}
function Ra({
  action: n,
  className: l,
  description: i,
  eyebrow: a,
  title: t,
  ...s
}) {
  return /* @__PURE__ */ d("header", { className: N("nim-section-header", l), ...s, children: [
    /* @__PURE__ */ d("div", { children: [
      a ? /* @__PURE__ */ e("p", { className: "nim-label nim-section-header__eyebrow", children: a }) : null,
      /* @__PURE__ */ e("h2", { className: "nim-title nim-title--md", children: t }),
      i ? /* @__PURE__ */ e("p", { className: "nim-body nim-body--sm nim-section-header__description", children: i }) : null
    ] }),
    n ? /* @__PURE__ */ e("div", { className: "nim-section-header__action", children: n }) : null
  ] });
}
function Pi({
  className: n,
  footer: l,
  sections: i = [],
  ...a
}) {
  return /* @__PURE__ */ d("div", { className: N("nim-profile-screen", n), children: [
    /* @__PURE__ */ e(Vn, { ...a }),
    i.map((t) => /* @__PURE__ */ d("section", { className: "nim-profile-screen__section", children: [
      t.title ? /* @__PURE__ */ e(Ra, { description: t.description, title: t.title }) : null,
      /* @__PURE__ */ e(ga, { children: t.rows.map((s) => /* @__PURE__ */ e(
        ya,
        {
          className: N(s.danger && "nim-list-row--danger"),
          href: s.href,
          leading: s.icon ? /* @__PURE__ */ e(w, { name: s.icon, size: "md" }) : void 0,
          onClick: s.onToggle ? void 0 : s.onSelect,
          subtitle: s.subtitle,
          title: s.label,
          trailing: s.onToggle ? (
            // The row's own title names the switch, so the control
            // carries the name rather than repeating the text beside
            // itself. A toggle row is a div, never a button — a switch
            // inside a button is two controls in one target.
            /* @__PURE__ */ e(
              ta,
              {
                "aria-label": typeof s.label == "string" ? s.label : void 0,
                checked: s.checked ?? !1,
                onChange: (o) => {
                  var c;
                  return (c = s.onToggle) == null ? void 0 : c.call(s, o.target.checked);
                },
                children: ""
              }
            )
          ) : s.value !== void 0 ? /* @__PURE__ */ e("span", { className: "nim-profile-screen__value", children: s.value }) : void 0
        },
        s.key
      )) })
    ] }, t.key)),
    l ? /* @__PURE__ */ e("div", { className: "nim-profile-screen__footer", children: l }) : null
  ] });
}
function Bi({
  className: n,
  count: l = 5,
  label: i,
  onChange: a,
  readOnly: t = !1,
  size: s = "md",
  value: o
}) {
  const c = q(), [r, u] = S(null), h = r ?? o;
  return t || !a ? /* @__PURE__ */ e(
    "span",
    {
      "aria-label": `${i}: ${o}/${l}`,
      className: N("nim-rating", `nim-rating--${s}`, "nim-rating--static", n),
      role: "img",
      children: Array.from({ length: l }, (_, m) => /* @__PURE__ */ e(De, { fill: Math.min(Math.max(o - m, 0), 1) }, m))
    }
  ) : /* @__PURE__ */ d(
    "fieldset",
    {
      className: N("nim-rating", `nim-rating--${s}`, n),
      onMouseLeave: () => u(null),
      children: [
        /* @__PURE__ */ e("legend", { className: "nim-visually-hidden", children: i }),
        Array.from({ length: l }, (_, m) => {
          const p = m + 1;
          return /* @__PURE__ */ d("label", { className: "nim-rating__star", onMouseEnter: () => u(p), children: [
            /* @__PURE__ */ e(
              "input",
              {
                checked: o === p,
                className: "nim-choice__input",
                name: c,
                onChange: () => a(p),
                type: "radio",
                value: p
              }
            ),
            /* @__PURE__ */ e("span", { className: "nim-visually-hidden", children: p }),
            /* @__PURE__ */ e(De, { fill: Math.min(Math.max(h - m, 0), 1) })
          ] }, p);
        })
      ]
    }
  );
}
function De({ fill: n }) {
  return /* @__PURE__ */ d("span", { "aria-hidden": "true", className: "nim-rating__glyph", children: [
    /* @__PURE__ */ e(w, { className: "nim-rating__outline", name: "star", size: "md" }),
    /* @__PURE__ */ e("span", { className: "nim-rating__fill", style: { inlineSize: `${n * 100}%` }, children: /* @__PURE__ */ e(w, { name: "star", size: "md" }) })
  ] });
}
const Fa = {
  back: "Back",
  codeLabel: "Verification code",
  codeSubtitle: (n) => `Enter the code we sent to ${n}`,
  codeTitle: "Verification code",
  identifierLabel: "Email",
  passwordLabel: "Password",
  passwordSubtitle: "Use the email and password on your account.",
  passwordTitle: "Sign in with a password",
  phoneLabel: "Mobile number",
  phoneSubtitle: "Enter your mobile number. We will text you a code — no password.",
  phoneTitle: "Welcome",
  resend: "Send the code again",
  resendIn: (n) => `You can ask for a new code in ${n}s`,
  sendCode: "Send code",
  signIn: "Sign in",
  usePassword: "Sign in with a password instead",
  usePhone: "Sign in with a code instead",
  verify: "Verify and sign in"
}, he = (n, l) => n instanceof Error && n.message.trim() ? n.message.trim() : l;
function Ri({
  brand: n,
  className: l,
  codeLength: i = 5,
  copy: a,
  defaultCountry: t = "IR",
  defaultMethod: s = "code",
  footer: o,
  methods: c = ["code", "password"],
  onPasswordSignIn: r,
  onRequestCode: u,
  onVerifyCode: h,
  priority: _ = ["IR", "AE", "TR", "DE", "US", "GB"],
  resendSeconds: m = 60
}) {
  const p = { ...Fa, ...a }, [f, v] = S(
    c.includes(s) ? s : c[0]
  ), [b, y] = S(!1), [k, A] = S(t), [z, F] = S(""), [C, P] = S(""), [T, E] = S(""), [x, I] = S(""), [B, K] = S(!1), [j, W] = S(""), [V, g] = S(0), D = L(!1);
  Z(() => {
    if (V <= 0) return;
    const G = window.setTimeout(() => g((ee) => ee - 1), 1e3);
    return () => window.clearTimeout(G);
  }, [V]);
  const M = za(k, z), $ = z.replace(/\D/g, "").length >= 6, U = O(
    async (G = !1) => {
      if (!(B || !G && !$)) {
        K(!0), W("");
        try {
          await (u == null ? void 0 : u(M)), y(!0), P(""), g(m);
        } catch (ee) {
          W(he(ee, p.sendCode));
        } finally {
          K(!1);
        }
      }
    },
    [B, M, u, $, m, p.sendCode]
  ), be = O(
    async (G) => {
      if (!(D.current || G.length !== i)) {
        D.current = !0, K(!0), W("");
        try {
          await (h == null ? void 0 : h(M, G));
        } catch (ee) {
          W(he(ee, p.verify)), P("");
        } finally {
          D.current = !1, K(!1);
        }
      }
    },
    [i, M, h, p.verify]
  ), ve = O(async () => {
    if (!(B || !T.trim() || !x)) {
      K(!0), W("");
      try {
        await (r == null ? void 0 : r(T.trim(), x));
      } catch (G) {
        W(he(G, p.signIn));
      } finally {
        K(!1);
      }
    }
  }, [B, T, r, x, p.signIn]), ge = c.length > 1 ? /* @__PURE__ */ e(
    J,
    {
      onClick: () => {
        v(f === "code" ? "password" : "code"), W("");
      },
      size: "sm",
      variant: "ghost",
      children: f === "code" ? p.usePassword : p.usePhone
    }
  ) : null, de = j ? /* @__PURE__ */ e(Jn, { tone: "danger", children: j }) : null;
  return f === "password" ? /* @__PURE__ */ d(
    me,
    {
      action: {
        disabled: !T.trim() || !x,
        label: p.signIn,
        loading: B,
        onClick: () => void ve()
      },
      brand: n,
      className: l,
      footer: /* @__PURE__ */ d(Y, { children: [
        ge,
        o
      ] }),
      subtitle: p.passwordSubtitle,
      title: p.passwordTitle,
      children: [
        de,
        /* @__PURE__ */ e(
          ra,
          {
            autoComplete: "username",
            label: p.identifierLabel,
            onChange: (G) => E(G.target.value),
            type: "email",
            value: T
          }
        ),
        /* @__PURE__ */ e(
          Ea,
          {
            autoComplete: "current-password",
            label: p.passwordLabel,
            onChange: (G) => I(G.target.value),
            onKeyDown: (G) => {
              G.key === "Enter" && ve();
            },
            value: x
          }
        )
      ]
    }
  ) : b ? /* @__PURE__ */ d(
    me,
    {
      action: {
        disabled: C.length !== i,
        label: p.verify,
        loading: B,
        onClick: () => void be(C)
      },
      back: {
        label: p.back,
        onClick: () => {
          y(!1), P(""), W("");
        }
      },
      className: l,
      footer: /* @__PURE__ */ d(Y, { children: [
        V > 0 ? /* @__PURE__ */ e("p", { children: p.resendIn(V) }) : /* @__PURE__ */ e(J, { onClick: () => void U(!0), size: "sm", variant: "ghost", children: p.resend }),
        o
      ] }),
      subtitle: p.codeSubtitle(M),
      title: p.codeTitle,
      children: [
        de,
        /* @__PURE__ */ e(
          xa,
          {
            autoFocus: !0,
            label: p.codeLabel,
            length: i,
            onChange: P,
            onComplete: (G) => void be(G),
            value: C
          }
        )
      ]
    }
  ) : /* @__PURE__ */ d(
    me,
    {
      action: {
        disabled: !$,
        label: p.sendCode,
        loading: B,
        onClick: () => void U()
      },
      brand: n,
      className: l,
      footer: /* @__PURE__ */ d(Y, { children: [
        ge,
        o
      ] }),
      subtitle: p.phoneSubtitle,
      title: p.phoneTitle,
      children: [
        de,
        /* @__PURE__ */ e(
          La,
          {
            country: k,
            label: p.phoneLabel,
            onChange: F,
            onCountryChange: A,
            onSubmit: () => void U(),
            priority: _,
            value: z
          }
        )
      ]
    }
  );
}
function Fi({ children: n, className: l, closeLabel: i = "Close", footer: a, onClose: t, open: s, title: o }) {
  const c = L(null), r = L(null);
  return Z(() => {
    var _;
    if (!s) return;
    r.current = document.activeElement;
    const u = document.body.style.overflow;
    document.body.style.overflow = "hidden", (_ = c.current) == null || _.focus();
    const h = (m) => {
      m.key === "Escape" && t();
    };
    return window.addEventListener("keydown", h), () => {
      var m, p;
      document.body.style.overflow = u, window.removeEventListener("keydown", h), (p = (m = r.current) == null ? void 0 : m.focus) == null || p.call(m);
    };
  }, [t, s]), !s || typeof document > "u" ? null : re(
    /* @__PURE__ */ d(Y, { children: [
      /* @__PURE__ */ e("div", { className: "nim-sheet__scrim", onClick: t }),
      /* @__PURE__ */ d(
        "div",
        {
          "aria-label": typeof o == "string" ? o : i,
          "aria-modal": "true",
          className: N("nim-sheet__panel", l),
          ref: c,
          role: "dialog",
          tabIndex: -1,
          children: [
            /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-sheet__handle" }),
            o ? /* @__PURE__ */ d("div", { className: "nim-sheet__header", children: [
              /* @__PURE__ */ e("p", { className: "nim-title nim-title--md", children: o }),
              /* @__PURE__ */ e(R, { label: i, name: "close", onClick: t, size: "sm" })
            ] }) : null,
            /* @__PURE__ */ e("div", { className: "nim-sheet__body", children: n }),
            a ? /* @__PURE__ */ e("div", { className: "nim-sheet__footer", children: a }) : null
          ]
        }
      )
    ] }),
    document.body
  );
}
function Oi({
  className: n,
  label: l,
  max: i = 100,
  min: a = 0,
  scale: t,
  step: s = 1,
  value: o,
  ...c
}) {
  const r = i === a ? 0 : (o - a) / (i - a) * 100;
  return /* @__PURE__ */ d("div", { className: "nim-field", children: [
    l ? /* @__PURE__ */ e("span", { className: "nim-field__label", children: l }) : null,
    /* @__PURE__ */ e(
      "input",
      {
        "aria-label": l,
        className: N("nim-slider", n),
        max: i,
        min: a,
        step: s,
        style: { "--nim-slider-progress": `${r}%` },
        type: "range",
        value: o,
        ...c
      }
    ),
    t ? /* @__PURE__ */ e("div", { "aria-hidden": "true", className: "nim-inline", style: { justifyContent: "space-between" }, children: t.map((u) => /* @__PURE__ */ e("span", { className: "nim-caption", children: u }, u)) }) : null
  ] });
}
function Ui({ className: n, delta: l, deltaDirection: i = "up", label: a, unit: t, value: s, ...o }) {
  return /* @__PURE__ */ d("div", { className: N("nim-stat", n), ...o, children: [
    /* @__PURE__ */ d("p", { className: "nim-stat__value", children: [
      s,
      t ? /* @__PURE__ */ e("span", { className: "nim-stat__unit", children: t }) : null
    ] }),
    /* @__PURE__ */ e("p", { className: "nim-label nim-stat__label", children: a }),
    l ? /* @__PURE__ */ d("p", { className: "nim-stat__delta", "data-direction": i, children: [
      /* @__PURE__ */ e(w, { name: i === "up" ? "trend-up" : "trend-down", size: "xs" }),
      l
    ] }) : null
  ] });
}
function Gi({
  className: n,
  decrementLabel: l = "Decrease",
  incrementLabel: i = "Increase",
  label: a,
  max: t = Number.MAX_SAFE_INTEGER,
  min: s = 0,
  onChange: o,
  step: c = 1,
  value: r
}) {
  const u = (h) => Math.min(Math.max(h, s), t);
  return /* @__PURE__ */ d(
    "div",
    {
      "aria-label": a,
      "aria-valuemax": t,
      "aria-valuemin": s,
      "aria-valuenow": r,
      className: N("nim-stepper", n),
      role: "spinbutton",
      tabIndex: 0,
      onKeyDown: (h) => {
        h.key === "ArrowUp" && (h.preventDefault(), o(u(r + c))), h.key === "ArrowDown" && (h.preventDefault(), o(u(r - c)));
      },
      children: [
        /* @__PURE__ */ e(
          "button",
          {
            "aria-label": l,
            className: "nim-stepper__button",
            disabled: r <= s,
            onClick: () => o(u(r - c)),
            tabIndex: -1,
            type: "button",
            children: /* @__PURE__ */ e(w, { name: "minus", size: "sm" })
          }
        ),
        /* @__PURE__ */ e("span", { className: "nim-stepper__value", children: r }),
        /* @__PURE__ */ e(
          "button",
          {
            "aria-label": i,
            className: "nim-stepper__button",
            disabled: r >= t,
            onClick: () => o(u(r + c)),
            tabIndex: -1,
            type: "button",
            children: /* @__PURE__ */ e(w, { name: "plus", size: "sm" })
          }
        )
      ]
    }
  );
}
const Oa = {
  of: (n, l) => `${n} of ${l} steps`,
  status: {
    active: "In progress",
    done: "Done",
    failed: "Failed",
    pending: "Waiting",
    skipped: "Skipped"
  }
}, Ua = {
  done: "check",
  failed: "close",
  pending: "clock",
  skipped: "minus"
};
function Ki({
  action: n,
  caption: l,
  className: i,
  labels: a,
  steps: t,
  title: s,
  value: o
}) {
  const c = { ...Oa, ...a }, r = t.filter((_) => _.status === "done" || _.status === "skipped").length, u = o ?? (t.length ? Math.round(r / t.length * 100) : 0), h = t.some((_) => _.status === "failed");
  return /* @__PURE__ */ d(
    "section",
    {
      "aria-live": "polite",
      className: N("nim-task", h && "nim-task--failed", i),
      children: [
        /* @__PURE__ */ d("header", { className: "nim-task__head", children: [
          s ? /* @__PURE__ */ e("h2", { className: "nim-task__title", children: s }) : null,
          l ? /* @__PURE__ */ e("p", { className: "nim-task__caption", children: l }) : null,
          /* @__PURE__ */ e(Qn, { label: c.of(r, t.length), value: u })
        ] }),
        /* @__PURE__ */ e("ol", { className: "nim-task__steps", children: t.map((_) => /* @__PURE__ */ d("li", { className: "nim-task__step", "data-status": _.status, children: [
          /* @__PURE__ */ e("span", { className: "nim-task__marker", children: _.status === "active" ? /* @__PURE__ */ e(Le, { size: "sm" }) : /* @__PURE__ */ e(w, { name: Ua[_.status], size: "xs" }) }),
          /* @__PURE__ */ d("span", { className: "nim-task__step-text", children: [
            /* @__PURE__ */ e("span", { className: "nim-task__step-label", children: _.label }),
            /* @__PURE__ */ e("span", { className: "nim-task__step-detail", children: _.detail ?? c.status[_.status] })
          ] })
        ] }, _.id)) }),
        n ? /* @__PURE__ */ e("div", { className: "nim-task__action", children: n }) : null
      ]
    }
  );
}
function Wi({ className: n, density: l = "default", entries: i }) {
  return /* @__PURE__ */ e("ol", { className: N("nim-timeline", l === "compact" && "nim-timeline--compact", n), children: i.map((a) => /* @__PURE__ */ d("li", { className: "nim-timeline__entry", "data-tone": a.tone, children: [
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-timeline__marker", children: a.icon ? /* @__PURE__ */ e(w, { name: a.icon, size: "xs" }) : /* @__PURE__ */ e("span", { className: "nim-timeline__dot" }) }),
    /* @__PURE__ */ d("div", { className: "nim-timeline__content", children: [
      /* @__PURE__ */ d("div", { className: "nim-timeline__head", children: [
        /* @__PURE__ */ e("span", { className: "nim-timeline__title", children: a.title }),
        a.time ? /* @__PURE__ */ e("time", { className: "nim-timeline__time", children: a.time }) : null
      ] }),
      a.body && l !== "compact" ? /* @__PURE__ */ e("div", { className: "nim-timeline__body", children: a.body }) : null
    ] })
  ] }, a.id)) });
}
function Hi({ caption: n, className: l, columns: i, onSort: a, rowKey: t, rows: s, sort: o }) {
  return /* @__PURE__ */ e("div", { className: N("nim-table-wrap", l), children: /* @__PURE__ */ d("table", { className: "nim-table", children: [
    n ? /* @__PURE__ */ e("caption", { className: "nim-caption", children: n }) : null,
    /* @__PURE__ */ e("thead", { children: /* @__PURE__ */ e("tr", { children: i.map((c) => {
      const r = (o == null ? void 0 : o.key) === c.key ? o.direction : void 0;
      return /* @__PURE__ */ e(
        "th",
        {
          "aria-sort": r,
          className: N(c.numeric && "nim-table__cell--numeric"),
          scope: "col",
          style: c.width ? { inlineSize: c.width } : void 0,
          children: c.sortable && a ? /* @__PURE__ */ d("button", { className: "nim-table__sort", onClick: () => a(c.key), type: "button", children: [
            c.header,
            r ? /* @__PURE__ */ e(w, { name: r === "ascending" ? "chevron-up" : "chevron-down", size: "xs" }) : null
          ] }) : c.header
        },
        c.key
      );
    }) }) }),
    /* @__PURE__ */ e("tbody", { children: s.map((c) => /* @__PURE__ */ e("tr", { children: i.map((r) => /* @__PURE__ */ e("td", { className: N(r.numeric && "nim-table__cell--numeric"), children: r.render(c) }, r.key)) }, t(c))) })
  ] }) });
}
function Yi({ className: n, label: l, onChange: i, options: a, value: t, ...s }) {
  const o = L(null), c = (r) => {
    var p, f;
    const u = r.key === "ArrowRight" ? 1 : r.key === "ArrowLeft" ? -1 : 0;
    if (u === 0) return;
    r.preventDefault();
    const h = a.filter((v) => !v.disabled), _ = h.findIndex((v) => v.value === t), m = h[(_ + u + h.length) % h.length];
    m && (i(m.value), (f = (p = o.current) == null ? void 0 : p.querySelector(`[data-value="${m.value}"]`)) == null || f.focus());
  };
  return /* @__PURE__ */ e(
    "div",
    {
      "aria-label": l,
      className: N("nim-tabs", n),
      onKeyDown: c,
      ref: o,
      role: "tablist",
      ...s,
      children: a.map((r) => /* @__PURE__ */ d(
        "button",
        {
          "aria-selected": r.value === t,
          className: "nim-tab",
          "data-value": r.value,
          disabled: r.disabled,
          onClick: () => i(r.value),
          role: "tab",
          tabIndex: r.value === t ? 0 : -1,
          type: "button",
          children: [
            r.label,
            r.count === void 0 ? null : /* @__PURE__ */ e("span", { className: "nim-tab__count", children: r.count })
          ]
        },
        r.value
      ))
    }
  );
}
const Ue = pe(null), Ga = {
  accent: "sparkle",
  danger: "danger",
  neutral: "info",
  success: "check-circle"
};
function Zi({ children: n }) {
  const [l, i] = S([]), a = L(0), t = O((c) => {
    i((r) => r.filter((u) => u.id !== c));
  }, []), s = O(
    (c) => {
      const r = a.current++;
      i((h) => [...h, { ...c, id: r }]);
      const u = c.duration ?? 4e3;
      u > 0 && window.setTimeout(() => t(r), u);
    },
    [t]
  ), o = H(() => s, [s]);
  return /* @__PURE__ */ d(Ue.Provider, { value: o, children: [
    n,
    typeof document < "u" ? re(
      /* @__PURE__ */ e("div", { "aria-live": "polite", className: "nim-toast-stack", children: l.map((c) => /* @__PURE__ */ d("div", { className: N("nim-toast", `nim-toast--${c.tone ?? "neutral"}`), children: [
        /* @__PURE__ */ e(w, { className: "nim-toast__icon", name: Ga[c.tone ?? "neutral"], size: "sm" }),
        /* @__PURE__ */ e("span", { className: "nim-toast__message", children: c.message }),
        c.action ? /* @__PURE__ */ e(
          "button",
          {
            className: "nim-toast__action",
            onClick: () => {
              var r;
              (r = c.action) == null || r.onPress(), t(c.id);
            },
            type: "button",
            children: c.action.label
          }
        ) : null
      ] }, c.id)) }),
      document.body
    ) : null
  ] });
}
function Vi() {
  const n = fe(Ue);
  if (!n) throw new Error("useToast must be used inside <ToastProvider>");
  return n;
}
function ji({ children: n, className: l, label: i }) {
  return /* @__PURE__ */ d("span", { className: N("nim-tooltip", l), children: [
    n,
    /* @__PURE__ */ e("span", { "aria-hidden": "true", className: "nim-tooltip__bubble", role: "tooltip", children: i })
  ] });
}
const Ka = {
  back: "Back",
  close: "Close",
  step: (n, l) => `Step ${n + 1} of ${l}`
};
function Ji({
  className: n,
  continueLabel: l,
  finishLabel: i,
  labels: a,
  onClose: t,
  onDone: s,
  onStep: o,
  steps: c
}) {
  const r = { ...Ka, ...a }, [u, h] = S(0), _ = c[Math.min(u, c.length - 1)], m = u === c.length - 1, p = O(
    (f) => {
      h(f), o == null || o(f);
    },
    [o]
  );
  return /* @__PURE__ */ d("section", { className: N("nim-wizard", n), children: [
    /* @__PURE__ */ d("header", { className: "nim-wizard__bar", children: [
      /* @__PURE__ */ e("span", { className: "nim-wizard__slot", children: u > 0 ? /* @__PURE__ */ e(R, { label: r.back, name: "chevron-back", onClick: () => p(u - 1), size: "sm" }) : null }),
      /* @__PURE__ */ e("ol", { "aria-label": r.step(u, c.length), className: "nim-wizard__dots", children: c.map((f, v) => /* @__PURE__ */ e(
        "li",
        {
          className: "nim-wizard__dot",
          "data-done": v < u ? "true" : void 0,
          "data-on": v === u ? "true" : void 0
        },
        f.id
      )) }),
      /* @__PURE__ */ e("span", { className: "nim-wizard__slot", children: t ? /* @__PURE__ */ e(R, { label: r.close, name: "close", onClick: t, size: "sm" }) : null })
    ] }),
    _.question ? /* @__PURE__ */ d("div", { className: "nim-wizard__ask", children: [
      /* @__PURE__ */ e("h1", { className: "nim-wizard__question", children: _.question }),
      _.subtitle ? /* @__PURE__ */ e("p", { className: "nim-wizard__subtitle", children: _.subtitle }) : null
    ] }) : null,
    /* @__PURE__ */ e("div", { className: "nim-wizard__content", children: _.content }),
    /* @__PURE__ */ e("footer", { className: "nim-wizard__foot", children: /* @__PURE__ */ e(
      J,
      {
        disabled: _.canContinue === !1,
        fullWidth: !0,
        onClick: () => m ? s() : p(u + 1),
        size: "lg",
        variant: "accent",
        children: _.continueLabel ?? (m ? i : l)
      }
    ) })
  ] });
}
function Qi({
  className: n,
  max: l,
  multiple: i = !1,
  onChange: a,
  options: t,
  selected: s
}) {
  const o = i && l !== void 0 && s.length >= l, c = (r) => {
    if (!i) {
      a([r]);
      return;
    }
    a(s.includes(r) ? s.filter((u) => u !== r) : [...s, r]);
  };
  return /* @__PURE__ */ e("div", { className: N("nim-choice-grid", n), role: i ? "group" : "radiogroup", children: t.map((r) => {
    const u = s.includes(r.id);
    return /* @__PURE__ */ d(
      "button",
      {
        "aria-checked": u,
        className: "nim-choice-grid__tile",
        "data-on": u ? "true" : void 0,
        disabled: r.disabled || o && !u,
        onClick: () => c(r.id),
        role: i ? "checkbox" : "radio",
        type: "button",
        children: [
          r.icon ? /* @__PURE__ */ e("span", { className: "nim-choice-grid__icon", children: r.icon }) : null,
          /* @__PURE__ */ e("span", { className: "nim-choice-grid__label", children: r.label })
        ]
      },
      r.id
    );
  }) });
}
function Xi({ as: n = "h1", children: l, className: i, ...a }) {
  return /* @__PURE__ */ e(n, { className: N("nim-display", i), ...a, children: l });
}
function qi({
  as: n = "h2",
  children: l,
  className: i,
  size: a = "lg",
  ...t
}) {
  return /* @__PURE__ */ e(n, { className: N("nim-title", a === "md" && "nim-title--md", i), ...t, children: l });
}
function el({
  as: n = "p",
  children: l,
  className: i,
  size: a = "md",
  ...t
}) {
  return /* @__PURE__ */ e(n, { className: N("nim-body", a === "sm" && "nim-body--sm", i), ...t, children: l });
}
function nl({ as: n = "span", children: l, className: i, ...a }) {
  return /* @__PURE__ */ e(n, { className: N("nim-label", i), ...a, children: l });
}
function al({ as: n = "p", children: l, className: i, ...a }) {
  return /* @__PURE__ */ e(n, { className: N("nim-caption", i), ...a, children: l });
}
function il({ className: n, ...l }) {
  return /* @__PURE__ */ e("hr", { className: N("nim-rule", n), ...l });
}
export {
  qa as Accordion,
  ri as ActionBar,
  Xa as ActivityFeed,
  ja as AdminShell,
  Ai as AppFrame,
  ei as AppShell,
  me as AuthScreen,
  Zn as Avatar,
  ni as AvatarRing,
  ai as Badge,
  Jn as Banner,
  el as Body,
  ii as Breadcrumb,
  J as Button,
  se as COUNTRIES,
  Re as Calendar,
  al as Caption,
  li as Card,
  oi as Chat,
  di as ChatComposer,
  mi as Checkbox,
  sa as Chip,
  _i as ChipInput,
  Qi as ChoiceGrid,
  bi as Combobox,
  pi as DataList,
  ki as DateField,
  wi as DatePicker,
  Ja as DetailHeader,
  Ci as Dialog,
  Xi as Display,
  Si as EmptyState,
  xi as FileDrop,
  Qa as FilterChips,
  w as Icon,
  R as IconButton,
  Ei as Inline,
  ra as Input,
  nl as Label,
  ga as List,
  ya as ListRow,
  vi as Menu,
  gi as NimProvider,
  Mi as Onboarding,
  ti as OptionCard,
  si as OrderSummary,
  xa as OtpInput,
  zi as Pagination,
  Ea as PasswordField,
  La as PhoneField,
  Ia as PlanCard,
  Ii as PlanPicker,
  oa as Popover,
  Vn as ProfileHeader,
  Pi as ProfileScreen,
  Qn as Progress,
  ui as Radio,
  hi as RadioGroup,
  Bi as Rating,
  Ti as ResourceMeter,
  il as Rule,
  Ra as SectionHeader,
  Pa as Segmented,
  Ni as Select,
  Fi as Sheet,
  Ri as SignInFlow,
  ci as Skeleton,
  Oi as Slider,
  Le as Spinner,
  Di as Stack,
  Ui as Stat,
  Gi as Stepper,
  ta as Switch,
  Hn as TabBar,
  Hi as Table,
  Yi as Tabs,
  Ki as TaskProgress,
  fi as Textarea,
  Wi as Timeline,
  qi as Title,
  Zi as ToastProvider,
  ji as Tooltip,
  Ji as Wizard,
  ue as addDays,
  Ce as addMonths,
  N as cn,
  Li as countryByDial,
  Oe as countryByIso2,
  Ta as countryNamer,
  _e as formatNumeric,
  ie as fromParts,
  Va as iconNames,
  Be as monthLength,
  ba as parseNumeric,
  Q as partsOf,
  $i as scorePassword,
  ha as startOfMonth,
  le as toAsciiDigits,
  za as toE164,
  oe as todayIso,
  ce as useNim,
  yi as useSchemeToggle,
  Vi as useToast
};
