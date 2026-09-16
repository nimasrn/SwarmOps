--[[
Right-to-left documents mix Persian sentences with Latin names, code and
numbers. XeLaTeX's bidi package lays out every word of an unmarked run in the
paragraph's direction, so "SwarmOps Cloud" would print as "Cloud SwarmOps".
This filter wraps each maximal run of left-to-right inlines in a span with
dir="ltr"; pandoc writes such a span as \LR{...} for LaTeX and as a
left-to-right run for DOCX. Punctuation that ends or opens a run stays outside
the span so it lands on the Persian side of the sentence.

It is applied only to the Persian documents.
]]

-- UTF-8 lead bytes 0xD8-0xDB cover U+0600-U+06FF (Arabic script, including
-- Persian letters and digits); 0xEF 0xAD-0xBB covers presentation forms.
local function has_arabic(text)
  return text:find('[\216-\219][\128-\191]') ~= nil or text:find('\239[\173-\187]') ~= nil
end

local function has_latin(text)
  return text:find('[A-Za-z0-9]') ~= nil
end

local function is_punctuation(text)
  return not has_latin(text) and not has_arabic(text)
end

local function is_ltr(el)
  if el.t == 'Code' then
    return true
  end
  if el.t == 'Str' then
    return has_latin(el.text) and not has_arabic(el.text)
  end
  if el.t == 'Emph' or el.t == 'Strong' or el.t == 'Link' or el.t == 'Quoted' then
    local text = pandoc.utils.stringify(el)
    return has_latin(text) and not has_arabic(text)
  end
  return false
end

local function is_neutral(el)
  return el.t == 'Space' or el.t == 'SoftBreak' or (el.t == 'Str' and is_punctuation(el.text))
end

-- Splits opening ASCII punctuation off the first Str of a run, so it can stay
-- outside the left-to-right span.
local function split_lead(el)
  if el.t ~= 'Str' then
    return nil, el
  end
  local lead, rest = el.text:match('^([%(%["\']+)(.+)$')
  if not lead then
    return nil, el
  end
  return pandoc.Str(lead), pandoc.Str(rest)
end

-- Splits closing ASCII punctuation off the last Str of a run.
local function split_trail(el)
  if el.t ~= 'Str' then
    return el, nil
  end
  local rest, trail = el.text:match('^(.-)([%.,;:!%?%)%]"\']+)$')
  if not rest or rest == '' then
    return el, nil
  end
  return pandoc.Str(rest), pandoc.Str(trail)
end

-- A block marked `::: ltr` (references, for example) is set left to right as a
-- whole: xepersian's latin environment for LaTeX, a dir="ltr" division
-- otherwise. Filters run bottom-up, so its runs have already been marked; the
-- marks are removed again, since the whole block is left to right.
local function unmark(content)
  return pandoc.walk_block(pandoc.Div(content), {
    RawInline = function(raw)
      if raw.format == 'latex' and (raw.text == '\\lr{' or raw.text == '}') then
        return {}
      end
    end,
    Span = function(span)
      if span.attributes.dir == 'ltr' then
        return span.content
      end
    end,
  })
end

function Div(el)
  if not el.classes:includes('ltr') then
    return nil
  end
  local plain = unmark(el.content)
  if FORMAT:match('latex') then
    return pandoc.Blocks {
      pandoc.RawBlock('latex', '\\begin{latin}'),
      plain,
      pandoc.RawBlock('latex', '\\end{latin}'),
    }
  end
  plain.attributes.dir = 'ltr'
  return plain
end

function Inlines(inlines)
  local out = pandoc.Inlines {}
  local i, n = 1, #inlines
  while i <= n do
    if is_ltr(inlines[i]) then
      local last, k = i, i + 1
      while k <= n do
        if is_ltr(inlines[k]) then
          last = k
          k = k + 1
        elseif is_neutral(inlines[k]) then
          k = k + 1
        else
          break
        end
      end
      local run = pandoc.Inlines {}
      for index = i, last do
        run:insert(inlines[index])
      end
      -- Lead first, then trail: for a one-word run both apply to the same Str.
      local lead, trail
      lead, run[1] = split_lead(run[1])
      run[#run], trail = split_trail(run[#run])
      if lead then
        out:insert(lead)
      end
      if FORMAT:match('latex') then
        -- xepersian's \lr. A span with a dir attribute would make pandoc's
        -- template define its own \LR before xepersian loads, and the two
        -- definitions recurse until TeX's input stack overflows.
        out:insert(pandoc.RawInline('latex', '\\lr{'))
        out:extend(run)
        out:insert(pandoc.RawInline('latex', '}'))
      else
        out:insert(pandoc.Span(run, pandoc.Attr('', {}, { { 'dir', 'ltr' } })))
      end
      if trail then
        out:insert(trail)
      end
      i = last + 1
    else
      out:insert(inlines[i])
      i = i + 1
    end
  end
  return out
end

