terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Zone ID for the production hostname. Do not apply until DNS is proxied through Cloudflare."
}

resource "cloudflare_ruleset" "crewforge_managed_waf" {
  zone_id     = var.cloudflare_zone_id
  name        = "CrewForge managed WAF"
  description = "Cloudflare managed protections for the CrewForge production hostname"
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  rules = [{
    ref         = "crewforge_cloudflare_managed_rules"
    description = "Execute Cloudflare Managed Ruleset"
    expression  = "true"
    action      = "execute"
    action_parameters = {
      id = "efb7b8c949ac4650a09736fc376e9aee"
    }
  }]
}

resource "cloudflare_ruleset" "crewforge_custom_waf" {
  zone_id     = var.cloudflare_zone_id
  name        = "CrewForge custom WAF"
  description = "Conservative request filtering; begin in log mode and tune from observed traffic"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules = [{
    ref         = "crewforge_block_obvious_scanners"
    description = "Block common exploit scanner paths"
    expression  = "(http.request.uri.path contains \"/.env\") or (http.request.uri.path contains \"/wp-admin\") or (http.request.uri.path contains \"/phpmyadmin\")"
    action      = "block"
    enabled     = true
  }]
}
