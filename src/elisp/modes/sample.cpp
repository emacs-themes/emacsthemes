#include <iostream>
#include <vector>
#include <string>
#include <memory>
#include <algorithm>

/**
 * Complex C++ sample for highlighting
 */

namespace ThemeSystem {

class Theme {
public:
    virtual ~Theme() = default;
    virtual void apply() const = 0;
    virtual std::string getName() const = 0;
};

class DarkTheme : public Theme {
private:
    std::string name;
    std::vector<std::string> tags;

public:
    DarkTheme(std::string n) : name(std::move(n)) {
        tags = {"dark", "high-contrast"};
    }

    void apply() const override {
        std::cout << "Applying dark theme: " << name << std::endl;
        for (const auto& tag : tags) {
            std::cout << "  Tag: " << tag << std::endl;
        }
    }

    std::string getName() const override { return name; }
};

} // namespace ThemeSystem

int main() {
    using namespace ThemeSystem;
    
    auto themes = std::vector<std::unique_ptr<Theme>>();
    themes.push_back(std::make_unique<DarkTheme>("Zenburn"));
    themes.push_back(std::make_unique<DarkTheme>("Monokai"));

    std::for_each(themes.begin(), themes.end(), [](const auto& t) {
        t->apply();
    });

    return 0;
}