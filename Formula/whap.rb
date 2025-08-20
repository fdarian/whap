class Whap < Formula
  desc "CLI and mock server for testing WhatsApp integration"
  homepage "https://github.com/fdarian/whap"
  version "0.1.0"
  url "https://github.com/fdarian/whap/releases/download/v0.1.0/whap-darwin-x64.tar.gz"
  sha256 "43b65a58761bf5659247d182c1ec1afe3d5a4130b88084338c9080267c6710e9"

  def install
    bin.install "whap"
  end

  test do
    system "#{bin}/whap", "--version"
  end
end