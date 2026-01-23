import 'dart:html' as html;

void updateFavicon(String url) {
  final link = html.document.querySelector('link[rel=\"icon\"]') as html.LinkElement?;
  if (link == null) {
    final newLink = html.LinkElement()
      ..rel = 'icon'
      ..href = url;
    html.document.head?.append(newLink);
    return;
  }
  link.href = url;
}
