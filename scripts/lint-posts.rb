#!/usr/bin/env ruby
# frozen_string_literal: true
#
# Validates that every published post has the front matter the layouts and SEO
# rely on. Run locally with `ruby scripts/lint-posts.rb`; CI runs it too.

require "yaml"
require "date"

REQUIRED = %w[layout title date description tags].freeze
ALLOWED_TAGS = %w[
  leadership engineering-management agile ai engineering-practice
  software-design architecture productivity career projects security
  algorithms culture wellbeing product hiring feedback communication
  mindset reflections networking testing azure agentic-workflows
].freeze

root = File.expand_path("..", __dir__)
posts = Dir[File.join(root, "_posts", "*.md")].sort
errors = []
unknown_tags = Hash.new { |h, k| h[k] = [] }

if posts.empty?
  warn "No posts found in _posts/"
  exit 1
end

posts.each do |path|
  name = File.basename(path)
  raw = File.read(path, encoding: "UTF-8")

  unless raw.start_with?("---")
    errors << "#{name}: missing YAML front matter"
    next
  end

  fm = raw.split(/^---\s*$/, 3)[1]
  data =
    begin
      YAML.safe_load(fm, permitted_classes: [Date, Time])
    rescue => e
      errors << "#{name}: unparseable front matter (#{e.message})"
      next
    end

  REQUIRED.each do |key|
    v = data[key]
    errors << "#{name}: missing or empty `#{key}`" if v.nil? || (v.respond_to?(:empty?) && v.empty?)
  end

  # Filename date prefix must match the `date:` field.
  if name =~ /^(\d{4}-\d{2}-\d{2})-/ && data["date"]
    file_date = Regexp.last_match(1)
    fm_date = data["date"].to_s[0, 10]
    errors << "#{name}: filename date #{file_date} != front matter date #{fm_date}" if file_date != fm_date
  end

  Array(data["tags"]).each do |t|
    unknown_tags[t] << name unless ALLOWED_TAGS.include?(t)
  end
end

unless unknown_tags.empty?
  warn "\nUnknown tags (add to ALLOWED_TAGS in scripts/lint-posts.rb if intentional):"
  unknown_tags.each { |t, files| warn "  #{t.inspect} in #{files.join(', ')}" }
  errors.concat(unknown_tags.keys.map { |t| "unknown tag #{t.inspect}" })
end

if errors.empty?
  puts "✓ #{posts.size} posts, front matter valid."
else
  warn "\n#{errors.size} problem(s):"
  errors.each { |e| warn "  - #{e}" }
  exit 1
end
