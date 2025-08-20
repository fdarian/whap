class Whap < Formula
  desc "CLI and mock server for testing WhatsApp integration"
  homepage "https://github.com/fdarian/whap"
  version "0.1.0"
  url "https://github.com/fdarian/whap/releases/download/v0.1.0/whap-darwin-x64.tar.gz"
  sha256 "placeholder_sha256_will_be_updated_by_ci"

  def install
    bin.install "whap"
  end

  test do
    system "#{bin}/whap", "--version"
  end
end